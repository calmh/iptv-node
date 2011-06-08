/*jslint onevar: true, node: true, continue: false, plusplus: false, bitwise: true,
newcap: true, strict: false, maxerr: 50, indent: 4, undef: true */

// Configuration:

var reportInterval = 30; // How often should probes check in statistics data?
var registerInterval = 300; // How often should probes register with master?

// Define channel packages:
var seChannels = [ '239.193.46.32', '239.193.46.33', '239.193.46.34', '239.193.46.35', '239.193.46.36', '239.193.46.37', '239.193.46.38', '239.193.46.39', '239.193.46.40', '239.193.46.64', '239.193.46.65', '239.193.46.66', '239.193.46.67', '239.193.46.68', '239.193.46.69', '239.193.46.70', '239.193.46.71', '239.193.46.72', '239.193.46.73', '239.193.46.74', '239.193.46.75', '239.193.46.76', '239.193.46.77', '239.193.46.78', '239.193.46.79', '239.193.46.80', '239.193.46.81' ];
var dkChannels = [ '239.193.45.32', '239.193.45.33', '239.193.45.34', '239.193.45.35', '239.193.45.64', '239.193.45.65', '239.193.45.66', '239.193.45.67', '239.193.45.68', '239.193.45.69', '239.193.45.70', '239.193.45.71', '239.193.45.72', '239.193.45.96', '239.193.45.97', '239.193.45.98', '239.193.45.99', '239.193.45.100', '239.193.45.101', '239.193.45.102', '239.193.45.103', '239.193.45.104', '239.193.45.105', '239.193.45.106' ];
var seBaseChannels = [ '239.193.46.32', '239.193.46.33', '239.193.46.34', '239.193.46.35', '239.193.46.36', '239.193.46.37', '239.193.46.38', '239.193.46.39', '239.193.46.40' ];
var allChannels = dkChannels.concat(seChannels);

// Match probe hostnames to channels:
var memberships = [ 
    { regexp: /.*vp.*/, memberships: seChannels },
    { regexp: /^probe1$/, memberships: allChannels },
    { regexp: /^probe2$/, memberships: allChannels },
    { regexp: /probe/, memberships: seBaseChannels },
];

// End of configuration.

var express = require('express');
var io = require('socket.io');
var _ = require('underscore')._;

var channelStats = {};
var discons = {};
var LN10 = Math.log(10);
var probes = {};

function realCleanChannelStats() {
    var cutoff, newChannelStats;
    cutoff = Math.round((new Date()).getTime() / 1000) - 3 * reportInterval;

    newChannelStats = {};
    _.each(channelStats, function (reports, group) {
        var newReports = {}, count = 0;
        _.each(reports, function (report, probe) {
            if (report.when > cutoff) {
                newReports[probe] = report;
                count += 1;
            }
        });

        if (count > 0) {
            newChannelStats[group] = newReports;
        }
    });

    channelStats = newChannelStats;
}
var cleanChannelStats = _.throttle(realCleanChannelStats, 60 * 1000);

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
    cleanChannelStats();
    var now = Math.round((new Date()).getTime() / 1000);
    res.setHeader('Content-Type', 'application/json');
    res.write(JSON.stringify({ status: channelStats, now: now, reportInterval: reportInterval }));
    res.end();
});

app.get('/*', function (req, res) {
    res.redirect('/');
});

app.post('/register', function (req, res) {
    var ip, obj, i, l, item;

    ip = req.socket.remoteAddress;
    obj = req.body;

    if (obj.register) {
        console.log('Register from ' + ip + ' for ' + obj.register);
        for (i = 0, l = memberships.length; i < l; i++) {
            item = memberships[i];
            if (item.regexp.test(obj.register)) {
                probes[ip] = obj.register;
                res.setHeader('Content-Type', 'application/json');
                res.write(JSON.stringify({ memberships: item.memberships, reportInterval: reportInterval, registerInterval: registerInterval }));
                break;
            }
        }
    }

    res.end();
});

app.post('/report', function (req, res) {
    var ip, obj, now, probe;

    ip = req.socket.remoteAddress;
    probe = probes[ip];

    if (typeof probe !== 'undefined') {
        console.log('Report from ' + probe);
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

                group[probe] = { when: now, pids: item.pids, mbps: item.mbps, pps: item.pps, dph: disconPerH };
            });
        }
    }

    res.end();
});

app.listen(80);

