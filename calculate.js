this.onmessage=function(response){

    console.log("worker received data")

    var score_matrix = response.data.score_matrix;
    var PS = response.data.PS;
    var outcomePs = response.data.outcomePs;

    var n_friends = PS.length;

    console.log("worker logged data")

    // preprocess the friends outcomes
    var FO = []
    for (var f = 0; f < n_friends; f++) {
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

    console.log(FO);

    var sort_order = Array.from(Array(outcomePs.length).keys()).sort((a, b) => outcomePs[a] > outcomePs[b] ? -1 : (outcomePs[b] > outcomePs[a]) | 0)

    // what are my chances of winning if I pick branch mp?
    var PWIN = [];
    for (var mp = 0; mp < 1000; mp++) {
        // console.log(mp)
        so = sort_order[mp];

        // cycle through all the outcomes
        var chance_win = 0.0;
        for (var i = 0; i < 8192; i++) {
            var my_score = score_matrix[i][so];

            // find chance I beat each friend with this pick and this outcome
            var friend_p_beats = []
            for (var f = 0; f < n_friends; f++) {
                friend_p_beats.push(1.0-FO[f][i][my_score]);
            }

            //outright win means I need to beat all friends
            var p_win = friend_p_beats.reduce((a, b) => a * b, 1);

            chance_win += p_win * outcomePs[i];

        }

        PWIN.push(chance_win);

        this.postMessage({count: mp, branch: so, result: chance_win, flag: true});
    }

    this.postMessage({result: PWIN, flag: false});

}