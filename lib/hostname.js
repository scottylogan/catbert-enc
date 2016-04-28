exports = module.exports = function hostnameInit (config) {

  return function hostnameClassifier (req, res, next) {
    //
    // map names to classes
    //

    if (config[req.node]) {
//      if (config[req.node].classes) {
        res.addClasses(config[req.node].classes);
//        config[req.node].classes.forEach(function (c) {
//          if (res.classes.indexOf(c) < 0) {
//            res.classes.push(c);
//        });
//      }

      // add the default classes
//      if (config.default && config.default.classes) {
        res.addClasses(config.default.classes);
//        config.default.classes.forEach(function (c) {
//          if (res.classes.indexOf(c) < 0) {
//            res.classes.push(c);
//        });
//      }

      // set the environment
      res.environment = config[req.node].environment ||
                        config.default.environment ||
                        res.environment;
    }
    next();
  };
};
