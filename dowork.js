var game_probs = null;
var score_matrix = null;

fetch('./game_probs.json')
    .then(response => response.json())
    .then(data => game_probs = data)
    .catch(error => console.log(error));

    
fetch('https://raw.githubusercontent.com/jacobwood27/052_bracketsim2/main/score_matrix.json.gz')
    .then(response => response.json())
    .then(data => score_matrix = data.dat)
    .catch(error => console.log(error));

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
    } else if (strat.type == "chalk") {
        return simulate_pick_against(0);
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

this.onmessage=function(response){
    console.log(game_probs)
    
    var dat = response.data;
    var outcomePs = outcome_probs();

    var PS = [];
    for (var f = 0; f < dat.length; f++) {
        var P = get_strat_av_P(dat[f]);
        PS.push(P);
    }

    var n_friends = PS.length;

    // preprocess the friends outcomes 
    // TODO: make faster
    var FO = []
    for (var f = 0; f < n_friends; f++) {
        this.postMessage({friend: f+1, friends: n_friends, flag: 0});
        P = PS[f]
        TFO = []

        for (var o = 0; o < 8192; o++) {
            var s30 = new Array(31).fill(0);
            for (var i = 0; i < 8192; i++) {
                p_tb = P[i]
                s_tb = score_matrix[o][i]
                for (var k = 0; k < s_tb+1; k++) {
                    s30[k] += p_tb
                }
            }
            TFO.push(s30)
        }
        FO.push(TFO);
    }
    console.log(FO)

    // what are my chances of winning if I pick branch mp?
    var PWIN = [];
    for (var mp = 0; mp < 8192; mp++) {
        
        // cycle through all the outcomes
        var chance_win = 0.0;
        for (var i = 0; i < 8192; i++) {
            var my_score = score_matrix[i][mp];

            // find chance I beat each friend with this pick and this outcome
            var friend_p_beats = []
            for (var f = 0; f < n_friends; f++) {
                friend_p_beats.push(1.0-FO[f][i][my_score]);
            }

            //outright win means I need to beat all friends
            var p_win = friend_p_beats.reduce((a, b) => a * b, 1);

            chance_win += p_win * outcomePs[i];

        }

        // this.postMessage({count: mp, result: chance_win, flag: 1});
        this.postMessage({count: mp, flag: 1});

        PWIN.push(chance_win);
        
    }

    this.postMessage({result: PWIN, flag: 2});

}