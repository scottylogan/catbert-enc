// the main classifier code
var fs              = require('fs'),
    path            = require('path');

// flatten an array
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

// the classifier wrapper function
exports = module.exports = function classifier(progName, nodeName, configDir, log) {
  var match,
      files       = fs.readdirSync(configDir),
      classifiers = [];

  // load all the configuration files with a .json suffix
  // directly under configDir
  files.forEach(function (filename) {
    var config;

    match = filename.match(/^(.+)\.json$/);
    if (match) {
      // log('Loading ' + filename);
      config = JSON.parse(fs.readFileSync(configDir + '/' + filename));

      // each configuration file must have a handler property that
      // specifies which classifier module to use
      if (!config.handler || typeof config.handler !== 'string') {
        throw new Error('Missing or invalid handler in ' + filename)
      }
      // log('Adding classifier ' + config.handler);
      // load the classifier and push it on the array of classifiers
      classifiers.push(require('./' + config.handler)(config));
    }
  });

  // return the actual classifier function
  // this is a typical connect-style middleware handler
  return function classify(req, res, cb) {
    var i = 0,
        classes = [];

    res.addClasses = function addClasses(newClasses) {
      if (newClasses) {
        if (!(newClasses instanceof Array)) {
          newClasses = [ newClasses ];
        }
        newClasses.forEach(function (c) {
          if (classes.indexOf(c) < 0) {
            classes.push(c);
          }
        });
      }
    };

    log('Starting classification');

    function next(err) {
      var o = {}; 

      if (err) {
        // next() was called with an error, so fail
        // immediately
        cb(err, null);
      } else {
        if (i >= classifiers.length) {
          // all the classifiers have run
          // add the classes to res
          res.classes = classes.sort();
          delete res.addClasses;
          // return to the caller
          cb(null, res);
        } else {
          // run the next classifier
          classifiers[i++].call(null, req, res, next);
        }
      }
    }

    // start the classification by calling the first
    // classifier
    next();

  };
};
