/**
 * Manages sites on the Kalabox virtual machine.
 *
 * Copyright 2013 Kalamuna LLC
 */

// Dependencies:
var flow = require('nue').flow,
    as = require('nue').as,
    exec = require('child_process').exec,
    http = require('http'),
    host = require('../utils/host'),
    config = require('../../config');

// "Constants":
var SITES_SOURCE = 'http://aliases.kala',
    KALASTACK_DIR = config.get('KALASTACK_DIR');

/**
 * Gets the list of sites, both running and available to build.
 *
 * @param function callback
 *   Callback to call with error, if one occurs, and object containing 'builtSites' and 'unbuiltSites'
 */
exports.getSitesList = flow('getSitesList')(
  function getSitesList0(callback) {
    this.data.callback = callback;
    // Get sites list from the VM.
    var that = this;
    http.get(SITES_SOURCE, this.async(as(0))).on('error', function(error) {
      that.endWith(error);
    });
  },
  function getSitesList1(response) {
    var that = this;
    that.data.data = '';
    response.on('data', function(chunk) {
      that.data.data += chunk;
    }).on('end', this.async(as(0)));
  },
  function getSitesListEnd(end) {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback(null, JSON.parse(this.data.data));
    }
    this.next();
  }
);

/**
 * Pull down site from Pantheon
 *
 * @param object options
 *   Site parameters with site (required) files, pipe.
 * @param function callback
 *   Function to call with error if one occurs.
 */
exports.buildSite = flow('buildSite')(
  function buildSite0(options, callback) {
    this.data.callback = callback;
    this.data.options = options;
    // Build command from site options.
    var command = 'KALABOX=on drush pullsite ';
    command += options.site;
    if (options.files) {
      command += ' --files';
    }
    if (options.pipe) {
      command += ' --pipe';
    }
    // Run command against VM via Vagrant.
    exec('vagrant ssh -c \'' + command + '\'', {cwd: KALASTACK_DIR}, this.async());
  },
  function buildSite1(stdout, stderr) {
    // Add site entry to /etc/hosts.
    var siteId = this.data.options.site.split('.');
    siteId = siteId[0];
    host.addHostsEntry(siteId + ".kala", this.async());
  },
  function buildSiteEnd() {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback();
    }
    this.next();
  }
);


/**
 * Builds a site on the virtual machine.
 *
 * @param object options
 *   Site parameters with site (required), siteName and profile.
 * @param function callback
 *   Function to call with error if one occurs.
 */
exports.newSite = flow('newSite')(
  function newSite0(options, callback) {
    this.data.callback = callback;
    this.data.options = options;
    // Build command from site options.
    var command = 'KALABOX=on drush newsite ';
    command += options.site;
    if (options.siteName) {
      command += ' --site-name="' + options.siteName + '"';
    }
    if (options.profile) {
      command += ' --profile="' + options.profile + '"';
    }
    // Run command against VM via Vagrant.
    exec('vagrant ssh -c \'' + command + '\'', {cwd: KALASTACK_DIR}, this.async());
  },
  function newSite1(stdout, stderr) {
    // Add site entry to /etc/hosts.
    host.addHostsEntry(this.data.options.site + ".kala", this.async());
  },
  function newSiteEnd() {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback();
    }
    this.next();
  }
);

/**
 * Removes a site from the virtual machine.
 *
 * @param object site
 *   Site object with aliasName (required) and builtFrom (for remote sites).
 * @param function callback
 *   Function to call with error if one occurs.
 */
exports.removeSite = flow('removeSite')(
  function removeSite0(site, callback) {
    this.data.callback = callback;
    this.data.site = site.uri;
    // Run command against VM via Vagrant.
    var alias = site.aliasName;

    exec('vagrant ssh -c \'KALABOX=on drush crush ' + alias + '\'', {cwd: KALASTACK_DIR}, this.async());
  },
  function removeSite1(stdout, stderr) {
    // Remove entry from /etc/hosts.
    host.removeHostsEntry(this.data.site, this.async());
  },
  function removeSiteEnd() {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback();
    }
    this.next();
  }
);

/**
 * Refreshes a site on the virtual machine.
 *
 * @param object options
 *   Refresh parameters with alias (required), refreshCode, refreshData, and refreshFiles.
 * @param function callback
 *   Function to call with error if one occurs.
 */
exports.refreshSite = flow('refreshSite')(
  function refreshSite0(options, callback) {
    this.data.options = options;
    this.data.callback = callback;
    this.data.alias = options.alias;
    this.data.pipe = options.pipe;
    // Refresh code if requested.
    if (options.refreshCode) {
      exec('vagrant ssh -c \'KALABOX=on drush pullcode ' + options.alias + '\'', {cwd: KALASTACK_DIR}, this.async());
    }
    else {
      this.next();
    }
  },
  function refreshSite1() {
    // Refresh database if requested.
    var command = 'KALABOX=on drush pulldata ';
    command += this.data.alias;
    if (this.data.pipe) {
      command += ' --pipe';
    }
    if (this.data.options.refreshData) {
      exec('vagrant ssh -c \'' + command + '\'', {cwd: KALASTACK_DIR}, this.async());
    }
    else {
      this.next();
    }
  },
  function refreshSite2() {
    // Refresh files if requested.
    if (this.data.options.refreshFiles) {
      exec('vagrant ssh -c \'KALABOX=on drush pullfiles ' + this.data.alias + '\'', {cwd: KALASTACK_DIR}, this.async());
    }
    else {
      this.next();
    }
  },
  function refreshSiteEnd() {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback();
    }
    this.next();
  }
);
