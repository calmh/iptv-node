var prevGroupsStr, prevProbesStr;
var tableIdRegexp = new RegExp("^\\d+\\.\\d+\\.\\d+\\.");
var minPps = 20; // Absolute minimum expected PPS for a channel.
var refreshInterval = 5; // seconds, will be updated by master server

// Workaround for Prototype swallowing all exceptions in callbacks.
Ajax.Responders.register({ 
    onException: function(request, exception) { 
        (function() { throw exception; }).defer(); 
    } 
});

function prepTables(groups, probes) {
    var tables, content, probeNames, probeToIp;

    probeNames = _.values(probes).sort();
    probeToIp = {};
    _.each(probes, function (probe, ip) {
        probeToIp[probe] = ip;
    });

    content = document.getElementById('content');
    tables = document.getElementById('tables');

    if (tables !== null) {
        tables.remove();
    }

    tables = document.createElement('div');
    tables.id = 'tables';
    content.appendChild(tables);

    _.each(groups, function (group) {
        var match, tableId;

        match = group.match(tableIdRegexp);
        if (match) {
            tableId = 'table-' + match[0];
            table = document.getElementById(tableId);

            if (table === null) {
                table = document.createElement('table');
                table.className = 'channels';
                table.id = tableId;
                tables.appendChild(table);

                row = document.createElement('tr');
                row.className = 'header';
                cell = document.createElement('th');
                row.appendChild(cell);

                _.each(probeNames, function (probe) {
                    var ip = probeToIp[probe];
                    cell = document.createElement('th');
                    cell.id = 'header-' + probe;
                    cell.className = 'probe';
                    //cell.innerHTML = '<abbr title="' + ip + '">' + probe + '</abbr>';
                    cell.innerHTML = probe + '<br /><span class="ip">' + ip + '</span>';
                    row.appendChild(cell);
                });

                table.appendChild(row);
            }

            row = document.createElement('tr');
            row.id = 'row-' + group;
            row.className = 'group';
            if (table.children.length % 2 === 1) {
                row.className += ' odd';
            }

            cell = document.createElement('th');
            cell.id = 'header-' + group;
            cell.className = 'group';
            cell.innerHTML = group;

            row.appendChild(cell);

            _.each(probeNames, function (probe) {
                cell = document.createElement('td');
                cell.id =  group + '-' + probe;
                cell.className = 'probe unknown tight';
                cell.innerHTML = '&mdash;';

                row.appendChild(cell);
            });

            table.appendChild(row);
        }
    });
}

function getChannelStatus() {
    new Ajax.Request('/status', {
        method: 'GET',
        onSuccess: function(response) {
            var obj, groups, probes, groupsStr, probesStr, table, row, cell, now;

            obj = response.responseJSON;

            if (obj.reportInterval) {
                refreshInterval = obj.reportInterval;
                document.getElementById('refreshInterval').innerHTML = refreshInterval;
            }

            if (obj.status) {
                now = obj.now;

                groups = _.keys(obj.status).sort(function (a, b) {
                    // IP numerical sort
                    var al, bl, an, bn;
                    al = _.map(a.split('.'), function (x) { return parseInt(x, 10); });
                    bl = _.map(b.split('.'), function (x) { return parseInt(x, 10); });
                    an = al[0]; an *= 256; an += al[1]; an *= 256; an += al[2]; an *= 256; an += al[3];
                    bn = bl[0]; bn *= 256; bn += bl[1]; bn *= 256; bn += bl[2]; bn *= 256; bn += bl[3];
                    return an - bn;
                });
                groupsStr = groups.join(',');

                probes = _.values(obj.probes).sort();
                probesStr = probes.join(',');

                if (prevGroupsStr !== groupsStr || prevProbesStr !== probesStr) {
                    prepTables(groups, obj.probes);
                    prevGroupsStr = groupsStr;
                    prevProbesStr = probesStr;
                }

                _.each(obj.status, function (probes, group) {
                    _.each(probes, function (stats, probe) {
                        var age;

                        cell = $(group + '-' + probe);
                        if (cell) {
                            cell.removeClassName('unknown');
                            cell.removeClassName('missing');
                            cell.removeClassName('warn');
                            cell.removeClassName('crit');
                            cell.removeClassName('ok');
                            age = now - stats.when;

                            cell.innerHTML = stats.mbps.toFixed(1) + ' M';
                            if (age > obj.reportInterval * 1.5 || stats.pps < minPps) {
                                cell.addClassName('missing');
                                cell.innerHTML = stats.pps + ' pps';
                            } else if (stats.dph > 20) {
                                cell.addClassName('crit');
                                cell.innerHTML = stats.dph + ' eph';
                            } else if (stats.dph > 0) {
                                cell.addClassName('warn');
                                cell.innerHTML = stats.dph + ' eph';
                            } else {
                                cell.addClassName('ok');
                            }
                        }
                    });
                });
            }

            setTimeout(getChannelStatus, refreshInterval * 1000);
        }
    });
}

getChannelStatus();

