/*jslint onevar: true, node: true, continue: false, plusplus: false, bitwise: true,
newcap: true, strict: false, maxerr: 50, indent: 4, undef: true */

/*global exports: false */

var assert = require('assert');
var fs = require('fs');
var _ = require('underscore')._;
var exec = require('child_process').exec;

// Convert IP-style group to hex in network byte order.
function groupToHex(group) {
    var octets, hexString;

    octets = group.split('.');
    assert.equal(octets.length, 4);

    hexString = _.reduce(octets, function (memo, octet) {
        var hex = parseInt(octet, 10).toString(16);
        if (hex.length < 2) {
            hex = '0' + hex;
        }
        return hex + memo;
    }, "");

    return hexString.toUpperCase();
}

exports.testGroupToHex = function () {
    assert.equal(groupToHex('239.193.46.32'), '202EC1EF');
    assert.equal(groupToHex('239.193.0.2'), '0200C1EF');
};

// Convert group from hex in network byte order to IP-style.
function groupFromHex(hexGroup) {
    var ip, octets;

    octets = _.compact(hexGroup.split(/(..)/));
    assert.equal(octets.length, 4);

    return _.map(octets, function (octet) {
        return parseInt(octet, 16).toString(10);
    }).reverse().join(".");
}

exports.testGroupFromHex = function () {
    assert.equal(groupFromHex('202EC1EF'), '239.193.46.32');
    assert.equal(groupFromHex('0200C1EF'), '239.193.0.2');
};

// Get list of groups currently subscribed.
exports.currentGroups = function (file) {
    var lines, groups, fileData;
    file = file || '/proc/net/igmp';

    fileData = fs.readFileSync(file, 'utf-8');
    lines = fileData.split('\n');
    groups = [];
    _.each(lines, function (line) {
        var match;

        match = line.match(/^\s+([0-9A-F]+)/);
        if (match) {
            groups.push(groupFromHex(match[1]));
        }
    });

    return groups;
};

exports.testCurrentGroups = function () {
    var groups = exports.currentGroups('fixtures/igmp_0');

    assert.equal(groups.length, 20);
    assert.equal(groups[1], '239.193.46.73');
};

// Check if we are a member of the specified group.
// Look in file, or default to /proc/net/igmp.
exports.isMemberOf = function (group, file) {
    var fileData, groups, hexGroup;
    groups = exports.currentGroups(file);

    return _.include(groups, group);
};

exports.testIsMemberOf = function () {
    assert.ok(exports.isMemberOf('239.193.46.33', 'fixtures/igmp_0'));
    assert.ok(!exports.isMemberOf('239.193.46.99', 'fixtures/igmp_0'));
};

// Return the operations needed to change the membership list
// 'actual' to 'wanted', in terms of leaves and joins.
exports.membershipDifference = function (actual, wanted) {
    var diff = {};
    diff.join = _.without.apply(this, [wanted].concat(actual));
    diff.leave = _.without.apply(this, [actual].concat(wanted));
    return diff;
};

exports.testMembershipDifference = function () {
    var wanted, actual, diff;

    wanted = [ '239.193.46.32', '239.193.46.33', '239.193.46.34' ];
    actual = [ '239.193.46.32', '239.193.46.34', '239.193.46.35' ];
    diff = exports.membershipDifference(actual, wanted);
    assert.ok(_.isEqual(diff.join, [ '239.193.46.33' ]));
    assert.ok(_.isEqual(diff.leave, [ '239.193.46.35' ]));
};

// Join specified multicast group.
exports.join = function (group, intf) {
    exec('smcroute -j ' + intf + ' ' + group);
};

// Leave specified multicast group.
exports.leave = function (group, intf) {
    exec('smcroute -l ' + intf + ' ' + group);
};

// Run unit tests if this module is started directly from the command line.
if (module === require.main) {
    require("test").run(exports);
}

