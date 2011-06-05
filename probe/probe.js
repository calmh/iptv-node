/*jslint onevar: true, node: true, continue: false, plusplus: false, bitwise: true,
newcap: true, strict: false, maxerr: 50, indent: 4, undef: true */

// Configuration:

var master = 'seluib4vp23.perspektivbredband.net'; // Hostname of the master server
var file = '/proc/net/xt_mpeg2ts/rule_iptv'; // Should match whatever rule is created in run script
var intf = 'eth0'; // intf to join multicast groups on
var httpPort = 8000; // Set to something like 80 or 8080 to enable local HTTP intf

// End of configuration.

var fs = require('fs');
var express = require('express');
var io = require('socket.io');
var http = require('http');
var _ = require('underscore')._;
var exec = require('child_process').exec;
var mcastroute = require('./mcastroute.js');
var analyzer = require('./analyzer.js');

var hostname;
var interval = 500;
var memberships = [];
var globalCache = {};
var registerInterval = 300 * 1000;
var reportInterval = 30 * 1000;

function setIgmpMembership() {
    var current, diff;

    current = mcastroute.currentGroups();
    diff = mcastroute.membershipDifference(current, memberships);

    _.each(diff.leave, function (group) {
        mcastroute.leave(group, intf);
    });

    _.each(diff.join, function (group) {
        mcastroute.join(group, intf);
    });
}

function register() {
    var options, req;

    options = { host: master, port: 80, path: '/register', method: 'POST', headers: { 'Content-Type': 'application/json' } };
    req = http.request(options, function (res) {
        var data = "";

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {
            var obj = JSON.parse(data);
            if (obj.memberships) {
                if (!_.isEqual(memberships, obj.memberships)) {
                    memberships = obj.memberships;
                    setIgmpMembership();
                    console.log('Updated memberships');
                }
            }

            if (obj.registerInterval) {
                registerInterval = obj.registerInterval;
            }

            if (obj.reportInterval) {
                reportInterval = obj.reportInterval;
            }
        });
    });

    req.on('error', function (e) {
        console.log('Register: ' + e.message);
    });

    req.write(JSON.stringify({ register: hostname, httpPort: httpPort }));
    req.end();

    _.delay(register, registerInterval);
}

function reportStatistics() {
    var options, req;

    options = { host: master, port: 80, path: '/report', method: 'POST', headers: { 'Content-Type': 'application/json' } };
    req = http.request(options);

    req.on('error', function (e) {
        console.log('Report: ' + e.message);
    });

    analyzer.reportFileData(globalCache, file, function (results) {
        results = _.select(results, function (result) {
            return _.include(memberships, result.dst);
        });

        req.write(JSON.stringify({report: results}));
        req.end();
    });

    _.delay(reportStatistics, reportInterval);
}

if (httpPort > 0) {
    var app = express.createServer(); 
    app.register('.jade', require('jade'));

    app.configure(function () {
        app.use(express.static(__dirname + '/public'));
    });

    app.get('/', function (req, res) {
        res.render('index.html.jade');
    });

    app.get('/*', function (req, res) {
        res.redirect('/');
    });

    app.listen(httpPort);

    var socket = io.listen(app); 
    socket.on('connection', function (client) { 
        var cache = {};
        analyzer.reportFileData(cache, file, null);

        client.on('message', function (data) {
            analyzer.reportFileData(cache, file, function (results) {
                var array;

                results = _.select(results, function (result) {
                    return _.include(memberships, result.dst);
                });

                if (data === 'poll') {
                    client.send({poll: results});
                } else if (data === 'short') {
                    array = results.map(function (i) {
                        return { dst: i.dst, mbps: i.mbps.toFixed(2), pps: i.pps };
                    });
                    client.send({short: array});
                }
            });
        });
    });
}

exec('hostname', function (error, stdout, stderr) {
    hostname = stdout.replace(/^\s+|\s+$/, '');
    console.log('My hostname is ' + hostname);
    register();
    reportStatistics();
});

