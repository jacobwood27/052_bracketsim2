function get_table_data() {
    var table = document.getElementById('stratTable');
    var rows = table.children[0].children;
    var data = [];
    for (var i = 1; i < rows.length - 1; i++) {
        var cells = rows[i].getElementsByTagName('td');
        var name = cells[0].children[0].value

        var strats = []
        var strat_rows = cells[1].children[0].children[0].children
        for (var j = 1; j < strat_rows.length - 1; j++) {
            var tcells = strat_rows[j].getElementsByTagName('td');
            var type = tcells[0].children[0].value
            var weight = parseFloat(tcells[1].children[0].value)
            var params = []
            if (type == "pick_against") {
                params = [parseFloat(tcells[2].children[0].value)];
            } else if (type == "favorite_team") {
                params = [parseInt(tcells[2].children[0].value), parseFloat(tcells[2].children[1].value)];
            } else if (type == "p_shift") {
                params = [parseFloat(tcells[2].children[0].value)];
            } else if (type == "extremify") {
                params = [parseFloat(tcells[2].children[0].value)];
            }

            var strat = { type: type, weight: weight, params: params }
            strats.push(strat)
        }

        tdata = { name: name, strats: strats }
        data.push(tdata)
    }
    return data;
}

// Random strat chooses a random winner of each game, so all 8192 branches are equally likely
function simulate_random() {
    return Array(8192).fill(1 / 8192);
}

function p_nodes(probs) {
    var nodes = Array(8191 + 8192).fill(0.01);
    nodes[0] = 1.0;
    for (var i = 1; i < 8191 + 8192; i++) {
        if (i % 2 == 0) {
            nodes[i] = nodes[(i - 2) / 2] * (1.0 - probs[(i - 2) / 2]);
        } else {
            nodes[i] = nodes[(i - 1) / 2] * (probs[(i - 1) / 2]);
        }
    }
    return nodes;
}


function collapse_probs(probs) {
    return p_nodes(probs).slice(8191);
}

function simulate_pick_against(n_upsets) {
    var chance_upset = n_upsets / 13.0;
    var p_game = Array(8191).fill(chance_upset);
    for (var i = 0; i < 8191; i++) {
        if (game_probs.dat[i][2] > 0.5) {
            p_game[i] = 1 - chance_upset;
        }
    }

    probs = collapse_probs(p_game);
    return probs;
}

function extremeP(p, a) {
    return (p ** a / (p ** a + (1.0 - p) ** a));
}

function simulate_favorite_team(fav, a) {

    var p_game = Array(8191).fill(0.0);
    for (var i = 0; i < 8191; i++) {
        if (game_probs.dat[i][0] == fav) {
            p_game[i] = 1.0;
        } else if (game_probs.dat[i][1] == fav) {
            p_game[i] = 0.0;
        } else {
            p_game[i] = extremeP(game_probs.dat[i][2], a);
        }
    }
    probs = collapse_probs(p_game);
    return probs;
}

function simulate_tossup(thresh) {

    var p_game = Array(8191).fill(0.0);
    for (var i = 0; i < 8191; i++) {
        if ((game_probs.dat[i][2] > 0.5 + thresh) || (game_probs.dat[i][2] < 0.5 - thresh)) {
            p_game[i] = game_probs.dat[i][2];
        } else {
            p_game[i] = 0.5;
        }
    }
    probs = collapse_probs(p_game);
    return probs;
}

function simulate_extremify(a) {

    var p_game = Array(8191).fill(0.0);
    for (var i = 0; i < 8191; i++) {
        p_game[i] = extremeP(game_probs.dat[i][2], a);
    }
    probs = collapse_probs(p_game);
    return probs;
}

function outcome_probs() {
    var p_game = Array(8191).fill(0.0);
    for (var i = 0; i < 8191; i++) {
        p_game[i] = game_probs.dat[i][2];
    }
    probs = collapse_probs(p_game);
    return probs;
}

function addscalevector(a, b, s) {
    return a.map((e, i) => e + s * b[i]);
}

function indexOfMax(arr) {
    var max = arr[0];
    var maxIndex = 0;

    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}

// This should return a list of floats of length 8192 that add up to 1, representing the probability of each branch for a given strat
function simulate_strat(strat) {
    if (strat.type == "random") {
        return simulate_random();
    } else if (strat.type == "pick_against") {
        return simulate_pick_against(strat.params[0]);
    } else if (strat.type == "favorite_team") {
        return simulate_favorite_team(strat.params[0], strat.params[1]);
    } else if (strat.type == "tossup") {
        return simulate_tossup(strat.params[0]);
    } else if (strat.type == "extremify") {
        return simulate_extremify(strat.params[0]);
    }
}

function get_strat_av_P(datrow) {
    P = Array(8192).fill(0.0);
    for (var i = 0; i < datrow.strats.length; i++) {
        probs = simulate_strat(datrow.strats[i])
        P = addscalevector(P, probs, datrow.strats[i].weight);
    }
    var divisor = P.reduce((a, b) => a + b, 0);
    P = P.map(i => i / divisor);
    return P
}

function get_games_on_branch(branch) {
    var games = [];
    var wins = []
    var game = 8191 + branch;
    while (game > 0) {
        if (game % 2 == 0) {
            wins.unshift(1);
        } else {
            wins.unshift(0);
        }

        game = Math.floor((game - 1) / 2);
        games.unshift(game_probs.dat[game]);

    }
    return [games, wins];
}



function update_table(responses) {
    var teams = {
        1: "KC", 2: "BUF", 3: "CIN", 4: "JAX", 5: "LAC", 6: "BAL", 7: "MIA",
        11: "PHI", 12: "SF", 13: "MIN", 14: "TB", 15: "DAL", 16: "NYG", 17: "SEA"
    }
    var lik_table = document.getElementById('likely_brackets');

    var scores = responses.map(i => i.result);
    var sort_order = Array.from(Array(scores.length).keys()).sort((a, b) => scores[a] > scores[b] ? -1 : (scores[b] > scores[a]) | 0)

    var prob_row = lik_table.children[0].children[0];

    for (i = 0; i < 3; i++) {
        if (i >= responses.length) {
            continue;
        }
        
        prob_row.children[i+1].innerHTML = round(responses[sort_order[i]].result * 100,1) + "%";
        
        var [g1, w1] =  get_games_on_branch(responses[sort_order[i]].branch);
        
        for (var j = 0; j < 13; j++) {


            lik_table.children[0].children[j + 1].children[2*i+1].innerHTML = teams[g1[j][0]];
            lik_table.children[0].children[j + 1].children[2*i+2].innerHTML = teams[g1[j][1]];
            if (w1[j] == 0) {
                lik_table.children[0].children[j + 1].children[2*i+1].className = "wincss";
                lik_table.children[0].children[j + 1].children[2*i+2].className = "losecss";
            } else {
                lik_table.children[0].children[j + 1].children[2*i+1].className = "losecss";
                lik_table.children[0].children[j + 1].children[2*i+2].className = "wincss";
            }
        }
    }

}

var webWorker = new Worker("calculate.js");

function calculate() {
    
    var dat = get_table_data();
    var outcomePs = outcome_probs();

    // run analysis for each friend
    var PS = [];
    for (var f = 0; f < dat.length; f++) {
        var P = get_strat_av_P(dat[f]);
        PS.push(P);
    }

    var responses = [];
    
    var data_in = {
        score_matrix: score_matrix,
        PS: PS,
        outcomePs: outcomePs
    }
    webWorker.postMessage(data_in);
    webWorker.onmessage = function (response){
        if (response.data.flag) {
            console.log(response.data.count, response.data.branch, response.data.result)
            responses.push(response.data)
            update_table(responses)

        } else {
            console.log(response.data.result)
        }
    }
}