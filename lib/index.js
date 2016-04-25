var fs              = require('fs'),
    path            = require('path');

function flatten(a) {
  var b = [];
  if (!(a instanceof Array)) {
    b.push(a);
  } else {
    a.forEach(function (an) {
      b = b.concat(flatten(an));
    });
  }
  return b;
}

exports = module.exports = function classifier(progName, nodeName, configDir, log) {
  var match,
      files       = fs.readdirSync(configDir),
      classifiers = [];

  files.forEach(function (filename) {
    var config;

    match = filename.match(/^(.+)\.json$/);
    if (match) {
      log('Loading ' + filename);
      config = JSON.parse(fs.readFileSync(configDir + path.sep + filename));
      log('Adding classifier ' + config.handler);
      classifiers.push(require('.' + path.sep + config.handler)(config));
    }
  });

  return function classify(req, res, cb) {
    var i       = 0,
        classes = {}; 

    log('Starting classification');

    function next(err) {
      if (err) {
        cb(err, null);
      } else {
        if (i >= classifiers.length) {
          log('Finished classification');
          flatten(res.classes).forEach(function (c) {
            Object.defineProperty(classes, c, {enumerable: true});
          });
          res.classes = Object.keys(classes).sort();
          cb(null, res);
        } else {
          classifiers[i++].call(null, req, res, next);
          i++;
        }
      }
    }

    next();

  };
};


