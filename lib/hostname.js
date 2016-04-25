exports = module.exports = function hostnameInit (config) {

  return function hostnameClassifier (req, res, next) {
    //
    // map names to classes
    //

    if (config[req.node]) {
      if (config[req.node].classes) {
        res.classes.push(config[req.node].classes);
      }

      // add the default classes
      if (config.default && config.default.classes) {
        res.classes.push(config.default.classes);
      }

      // set the environment
      res.environment = config[req.node].environment ||
                        config.default.environment ||
                        res.environment;
    }
    next();
  };
};
