var prevGroupsStr, prevProbesStr;
var tableIdRegexp = new RegExp("^\\d+\\.\\d+\\.\\d+\\.");
var minPps = 20; // Absolute minimum expected PPS for a channel.

// Workaround for Prototype swallowing all exceptions in callbacks.
Ajax.Responders.register({ 
    onException: function(request, exception) { 
        (function() { throw exception; }).defer(); 
    } 
});

function prepTables(groups, probes) {
    var tables, content;

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
                table.id = tableId;
                tables.appendChild(table);

                row = document.createElement('tr');
                row.className = 'header';
                cell = document.createElement('th');
                row.appendChild(cell);

                _.each(probes, function (probe) {
                    cell = document.createElement('th');
                    cell.id = 'header-' + probe;
                    cell.className = 'probe';
                    cell.innerHTML = probe;
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

            _.each(probes, function (probe) {
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

            if (obj.status) {
                now = obj.now;

                groups = _.keys(obj.status).sort();
                probes = _.uniq(_.flatten(_.map(obj.status, function (probes, group) { return _.keys(probes); })).sort(), 1);
                groupsStr = groups.join(',');
                probesStr = probes.join(',');

                if (prevGroupsStr !== groupsStr || prevProbesStr !== probesStr) {
                    prepTables(groups, probes);
                    prevGroupsStr = groupsStr;
                    prevProbesStr = probesStr;
                }

                _.each(obj.status, function (probes, group) {
                    _.each(probes, function (stats, probe) {
                        var age;

                        cell = $(group + '-' + probe);
                        if (cell) {
                            cell.removeClassName('unknown');
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

            setTimeout(getChannelStatus, 5000);
        }
    });
}

getChannelStatus();

