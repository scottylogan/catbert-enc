var localMap  = require('../local.json');
    
exports = module.exports = function localClassifier (req, res, next) {
  //
  // map names to classes
  //

  if (localMap[req.node]) {
    if (localMap[req.node].classes) {
      res.classes.push(localMap[req.node].classes);
    }

    // add the default classes
    if (localMap.default && localMap.default.classes) {
      res.classes.push(localMap.default.classes);
    }

    // set the environment
    res.environment = localMap[req.node].environment || localMap.default.environment || res.environment || 'production';
  }

  next();

}

