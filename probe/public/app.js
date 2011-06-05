var interval = 200; // (ms delay/request)
var maxMbps = 9;
var maxWidth = 150;

var maxPps = maxMbps * 1000 * 1000 / 8 / 1316;
var pixelsPerMbps = maxWidth / maxMbps;
var pixelsPerPps = maxWidth / maxPps;
var mbps = {};
var min = {};
var max = {};
var pps = {};
var count = {};
count.short = 0;
count.long = 0;

var maxCount = Math.round(1000 / interval);

function channelRow(obj) {
    var row = document.getElementById(obj.dst);
    if (row === null) {
        var el;
        var div;
        var table = document.getElementById("table");
        row = document.createElement('tr');
        row.id = obj.dst;

        // group
        el = document.createElement('td');
        el.id = obj.dst + '-group';
        el.innerHTML = obj.dst;
        row.appendChild(el);

        // pids
        el = document.createElement('td');
        el.id = obj.dst + '-pids';
        el.className = 'right';
        row.appendChild(el);

        // mbps meter
        el = document.createElement('td');
        el.className = 'meter';
        el.setAttribute('style', 'width: ' + maxWidth + 'px');

        div = document.createElement('div');
        div.id = obj.dst + '-mbps-meter';
        el.appendChild(div);

        div = document.createElement('div');
        div.id = obj.dst + '-mbps-max';
        div.className = 'neutral';
        el.appendChild(div);

        row.appendChild(el);

        // mbps
        el = document.createElement('td');
        el.id = obj.dst + '-mbps';
        el.className = 'right';
        row.appendChild(el);

        // variance
        el = document.createElement('td');
        el.id = obj.dst + '-variance';
        el.className = 'right';
        row.appendChild(el);

        // pps
        el = document.createElement('td');
        el.id = obj.dst + '-pps';
        el.className = 'right';
        row.appendChild(el);

        table.appendChild(row);
    }
    return row;
}

var socket = new io.Socket(document.domain);
socket.connect();

socket.on('connect', function () {
    setTimeout(function() { socket.send('poll'); }, interval);
});

socket.on('message', function (data) { 
    var obj, row, val, w, l, i, variance;

    if (data.poll) {
        count.long += 1;
        count.short = 0;
        array = data.poll;
    } else {
        count.short += 1;
        array = data.short;
    }

    for (i = 0; i < array.length; i++) {
        obj = array[i];
        row = channelRow(obj);

        // Update certain fields only every second or so
        if (typeof(obj.pids) !== 'undefined') {
            if (count.long % 10 === 0) {
                variance = (max[obj.dst] - min[obj.dst]) / 2;
                el = document.getElementById(obj.dst + '-variance');
                if (isNaN(variance)) {
                    el.innerHTML = '-';
                } else if (variance < 0.1) {
                    el.innerHTML = 'CBR';
                } else {
                    el.innerHTML = variance.toFixed(1) + ' M';
                }
                max[obj.dst] = obj.mbps;
                min[obj.dst] = obj.mbps;
            }

            // pids
            el = document.getElementById(obj.dst + '-pids');
            el.innerHTML = obj.pids;

            // mbps
            val = mbps[obj.dst] / count[obj.dst];
            el = document.getElementById(obj.dst + '-mbps');
            el.innerHTML = (val > 0 ? val.toFixed(1) : obj.mbps.toFixed(1)) + ' M';

            // pps
            val = pps[obj.dst] / count[obj.dst];
            el = document.getElementById(obj.dst + '-pps');
            el.innerHTML = val > 0 ? Math.round(val) : Math.round(obj.pps);

            mbps[obj.dst] = 0;
            pps[obj.dst] = 0;
            count[obj.dst] = 0;
        }

        mbps[obj.dst] += obj.mbps;
        max[obj.dst] = obj.mbps > max[obj.dst] ? obj.mbps : max[obj.dst];
        min[obj.dst] = obj.mbps < min[obj.dst] ? obj.mbps : min[obj.dst];
        pps[obj.dst] += obj.pps;
        count[obj.dst] += 1;

        // mbps meter
        el = document.getElementById(obj.dst + '-mbps-meter');
        el.setAttribute('style', 'width: ' + Math.round(obj.mbps * pixelsPerMbps) + 'px; height: 8px');
        if (obj.mbps > 1.0) {
            el.className = 'ok';
        } else if (obj.mbps > 0.5) {
            el.className = 'warn';
        } else {
            el.className = 'crit';
        }

        el = document.getElementById(obj.dst + '-mbps-max');
        l = Math.round(min[obj.dst] * pixelsPerMbps);
        w = Math.round(max[obj.dst] * pixelsPerMbps) - l;
        el.setAttribute('style', 'margin-left: ' + l + 'px; width: ' + w + 'px; height: 2px');
    }

    if (count.short === maxCount) {
        setTimeout(function() { socket.send('poll'); }, interval);
    } else {
        setTimeout(function() { socket.send('short'); }, interval);
    }
});

