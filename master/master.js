/*jslint onevar: true, node: true, continue: false, plusplus: false, bitwise: true,
newcap: true, strict: false, maxerr: 50, indent: 4, undef: true */

// Configuration:

var reportInterval = 60 * 1000; // How often should probes check in statistics data?
var registerInterval = 300 * 1000; // How often should probes register with master?

// Define channel packages:
var seChannels = [ '239.193.46.32', '239.193.46.33', '239.193.46.34', '239.193.46.35', '239.193.46.36', '239.193.46.37', '239.193.46.38', '239.193.46.39', '239.193.46.40', '239.193.46.64', '239.193.46.65', '239.193.46.66', '239.193.46.67', '239.193.46.68', '239.193.46.69', '239.193.46.70', '239.193.46.71', '239.193.46.72', '239.193.46.73', '239.193.46.74', '239.193.46.75', '239.193.46.76', '239.193.46.77', '239.193.46.78', '239.193.46.79', '239.193.46.80', '239.193.46.81' ];
var seBaseChannels = [ '239.193.46.32', '239.193.46.33', '239.193.46.34', '239.193.46.35', '239.193.46.36', '239.193.46.37', '239.193.46.38', '239.193.46.39', '239.193.46.40' ];

// Match probe hostnames to channels:
var memberships = [ 
    { regexp: /^probe/, memberships: seBaseChannels },
    { regexp: /.*vp.*/, memberships: seChannels }
];

// End of configuration.

var express = require('express');
var io = require('socket.io');
var _ = require('underscore')._;

var channelStats = {};
var discons = {};
var LN10 = Math.log(10);
var probes = {};

var app = express.createServer();
app.register('.jade', require('jade'));

app.configure(function () {
    app.use(express.static(__dirname + '/public'));
    app.use(express.bodyParser());
});

app.get('/', function (req, res) {
    res.render('index.html.jade');
});

app.get('/status', function (req, res) {
    var now = Math.round((new Date()).getTime() / 1000, 10);
    res.setHeader('Content-Type', 'application/json');
    res.write(JSON.stringify({ status: channelStats, now: now, reportInterval: reportInterval }));
    res.end();
});

app.get('/*', function (req, res) {
    res.redirect('/');
});

app.post('/register', function (req, res) {
    var ip, obj;

    ip = req.socket.remoteAddress;
    obj = req.body;

    if (obj.register) {
        _.each(memberships, function (item) {
            if (item.regexp.test(obj.register)) {
                probes[ip] = obj.register;
                res.setHeader('Content-Type', 'application/json');
                res.write(JSON.stringify({ memberships: item.memberships, reportInterval: reportInterval, registerInterval: registerInterval }));
                res.end();
            }
        });
    }

});

app.post('/report', function (req, res) {
    var ip, obj, now, probe;

    ip = req.socket.remoteAddress;
    probe = probes[ip];

    if (typeof probe !== 'undefined') {
        obj = req.body;
        now = Math.round((new Date()).getTime() / 1000, 10);

        if (obj.report) {
            _.each(obj.report, function (item) {
                var group, disconPerH, groupProbe, disconList, d_discon, d_sec;
                groupProbe = item.dst + '-' + probe;

                group = channelStats[item.dst];
                if (typeof group === 'undefined') {
                    group = channelStats[item.dst] = {};
                }

                disconList = discons[groupProbe];
                if (typeof disconList === 'undefined') {
                    disconList = discons[groupProbe] = [];
                }

                disconList.push({ when: now, discon: item.discon });
                if (disconList.length > 1) {
                    while (disconList[0].when < now - 3600) {
                        disconList.shift();
                    }
                    d_discon = (_.last(disconList).discon - disconList[0].discon);
                    d_sec = (_.last(disconList).when - disconList[0].when);
                    disconPerH = Math.round(3600 * d_discon / d_sec);
                } else {
                    disconPerH = 0;
                }

                group[probe] = { when: now, pids: item.pids, bytes: item.bytes, packets: item.packets, dph: disconPerH };
            });
        }
    }

    res.end();
});

app.listen(80);

