/*jslint onevar: true, node: true, continue: false, plusplus: false, bitwise: true,
newcap: true, strict: false, maxerr: 50, indent: 4, undef: true */

/*global exports: false */

var assert = require('assert');
var fs = require('fs');
var _ = require('underscore')._;

var LN10 = Math.log(10);

function parseLine(line) {
    var fields, result;
    fields = line.split(/\s+/);
    result = {};
    _.each(fields, function (field) {
        if (field.match(/^([^:]+):(\d+)$/)) {
            result[RegExp.$1] = parseInt(RegExp.$2, 10);
        } else if (field.match(/^([^:]+):(\d+\.\d+)$/)) {
            result[RegExp.$1] = parseFloat(RegExp.$2);
        } else if (field.match(/^([^:]+):(.+)$/)) {
            result[RegExp.$1] = RegExp.$2;
        }
    });
    return result;
}

exports.testParseLineGroup = function () {
    var obj = parseLine('bucket:35 dst:239.193.46.76 src:192.168.0.1 dport:10000 sport:10000 pids:6 skips:108 discontinuity:21 payload_bytes:8015037464 packets:6090454');
    assert.strictEqual(obj.bucket, 35);
    assert.strictEqual(obj.dst, '239.193.46.76');
    assert.strictEqual(obj.src, '192.168.0.1');
    assert.strictEqual(obj.dport, 10000);
    assert.strictEqual(obj.sport, 10000);
    assert.strictEqual(obj.pids, 6);
    assert.strictEqual(obj.skips, 108);
    assert.strictEqual(obj.discontinuity, 21);
    assert.strictEqual(obj.payload_bytes, 8015037464);
    assert.strictEqual(obj.packets, 6090454);
};

exports.testParseLineHeader = function () {
    var obj = parseLine('# info:time created:1306422371.219097603 now:1307282708.493404201 delta:860337.274306598');
    assert.strictEqual(obj.info, 'time');
    assert.strictEqual(obj.created, 1306422371.219097603);
    assert.strictEqual(obj.now, 1307282708.493404201);
    assert.strictEqual(obj.delta, 860337.274306598);
};

function handleFileData(data, cache, cb) {
    var now, lines, results;

    lines = data.split("\n");
    results = [];
    _.each(lines, function (line) {
        var parsed, obj, old, td, first, discPerPacket, curBer, startBer, diff, kBytes;

        parsed = parseLine(line);
        if (parsed.info === 'time') {
            now = Math.round(parsed.now * 1000);
        } else if (parsed.dst) {
            parsed.when = now;

            old = cache[parsed.dst];
            if (typeof old !== 'undefined') {
                td = now - old.when;

                if (parsed.discon === old.disconinuity) {
                    parsed.lastdiscon = old.lastdiscon;
                } else {
                    parsed.lastdiscon = now;
                }

                kBytes = (parsed.payload_bytes - old.payload_bytes) / td;

                diff = {};
                diff.dst = parsed.dst;
                diff.src = parsed.src;
                diff.pids = parsed.pids;
                diff.skips = parsed.skips;
                diff.discon = parsed.discontinuity;
                diff.mbps = Math.round(kBytes * 8) / 1000;
                diff.pps = parseInt((parsed.packets - old.packets) / td * 1000, 10);
                diff.lastdiscon = Math.round((now - parsed.lastdiscon) / 1000);

                results.push(diff);
            } else {
                parsed.lastdiscon = 0;
            }

            cache[parsed.dst] = parsed;
        }
    });

    if (typeof cb !== 'undefined' && cb !== null) {
        cb(results);
    }
}

exports.reportFileData = function (cache, file, cb) {
    fs.readFile(file, 'utf-8', function (err, data) {
        if (err) {
            throw err;
        }
        handleFileData(data, cache, cb);
    });
};

var callbackCounter = 0;
exports.testReportFileData = function () {
    var cache = {};

    exports.reportFileData(cache, 'fixtures/iptv_0', function (results) {
        assert.strictEqual(results.length, 0);
        callbackCounter += 1;

        exports.reportFileData(cache, 'fixtures/iptv_1', function (results) {
            assert.strictEqual(results.length, 2);

            assert.strictEqual(results[0].dst, '239.193.46.33');
            assert.strictEqual(results[0].src, '192.168.0.1');
            assert.strictEqual(results[0].pids, 9);
            assert.strictEqual(results[0].skips, 8741);
            assert.strictEqual(results[0].discon, 1911);
            assert.strictEqual(results[0].mbps, 6.377);
            assert.strictEqual(results[0].pps, 605);

            assert.strictEqual(results[1].dst, '239.193.46.67');
            assert.strictEqual(results[1].src, '192.168.0.1');
            assert.strictEqual(results[1].pids, 7);
            assert.strictEqual(results[1].skips, 2383);
            assert.strictEqual(results[1].discon, 579);
            assert.strictEqual(results[1].mbps, 4.24);
            assert.strictEqual(results[1].pps, 402);

            callbackCounter += 1;
        });
    });
};

process.addListener('exit', function () {
    assert.strictEqual(callbackCounter, 2);
});

// Run unit tests if this module is started directly from the command line.
if (module === require.main) {
    require("test").run(exports);
}

