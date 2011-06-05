iptv-node
=========

This is a simple web front end for the [IPTV Analyzer](http://www.iptv-analyzer.org/) kernel module. It is built around a distributed model, with 'probes' that receive and analyze streams, and a single 'master' that receives status reports and aggregates statistics. The `master` and `probe` processes can be run on the same server, and you can optionally use probes without a master server at all.

The master
----------

  * Receives register requests from probe nodes and pushes configuration variables to the probes.
  * Receives statistics from probe nodes.
  * Presents machine (JSON) and human interfaces over HTTP.

The probes
----------

  * Register with the master and receive the set of channels to monitor.
  * Periodically push statistics to the master.
  * Optionally present a live view of received channels on a web client.

Prerequisites
-------------

You need the [IPTV Analyzer](http://www.iptv-analyzer.org/) kernel module, compiled and ready to be loaded. You also need [Node.js](http://nodejs.org/) and its dependencies, mainly the V8 Javascript engine.

To use the provided startup scripts, you need [DJB:s daemon tools](http://cr.yp.to/daemontools.html).

Installation
------------

Unpack this distribution in whatever place you find suitable, such as `/usr/local/iptv-node`. Edit the configuration variables at the top of `probe/probe.js` and `master/master.js`.

If this is to be a master server, symlink `/usr/local/iptv-node/master` to `/etc/service/master`, or do the same for the `probe` directory to start a probe.

Usage
-----

  1. Start the master and the probes.
  2. Browse to `http://master-server/` to get an overview of what's happening.
  3. Use `http://master-server/status` to integrate with a monitoring system such as Nagios.
  4. If you enabled the HTTP interface on the probes, browse to them for a live view of the monitored channels.
