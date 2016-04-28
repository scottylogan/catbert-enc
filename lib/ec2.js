exports = module.exports = function ec2Init (config) {
  var aws = require('aws-sdk');
  
  config.profile = config.profile || 'default';
  config.regions = config.regions || [ 'us-west-2' ];

  return function ec2Classifier (req, res, next) {
    
    config.regions.forEach(function (region) {

      var match,
          filters = [],
          creds   = new aws.SharedIniFileCredentials({
                      profile: config.profile
                    }),
          awsOpts = { region: region, credentials: creds },
          ec2     = new aws.EC2(awsOpts),
          re      = new RegExp('^ip-(\\d+(-\\d+){3})\\.(' + 
                               config.domain.replace(/\./g,'\\.') +
                               '|[^\\.]+\\.compute\\.internal)$');
  

      // check for internal names
      // usually ip-a-b-c-d.region.compute.internal, but if
      // a custom DHCP option set with a custom domain is used
      // it will be ip-a-b-c-d.custom-domain
      //
      // the custom domain makes it easier for nodes to find
      // the puppet master
  
      match = req.node.match(re);
      if (match) {
        if (match[3] === config.domain) {
          req.log('EC2 node in a custom domain');
          // need to match on private IP rather than name
          filters.push({ Name: 'private-ip-address', Values: [ match[1].replace(/-/g, '.') ] });
        } else {
          req.log('EC2 node using a private address');
          // can match on given name
          filters.push({ Name: 'private-dns-name', Values: [ req.node ] });
        }
      }

      // check for public names
      // usually ec2-a-b-c-d.region.compute.amazonaws.com
    
      match = req.node.match(/^ec2-\d+(-\d+){3}\.[^\.]+\.compute\.amazonaws\.com$/);
      if (match) {
        req.log('EC2 node using a public address');
        filters.push({ Name: 'public-dns-name', Values: [ req.node ]});
      }
  
      // if any of the names matched EC2-ish names, we'll have a filter
      // for describeInstances.
  
      if (filters.length > 0) {
        ec2.describeInstances({Filters: filters}, function (err, info) {
          if (err) {
            next(err);
          } else if (info.Reservations.length === 1 ||
                     info.Reservations[0].Instances.length === 1)
          {
            // we have EC2 instance data to use for classification
  
            info = info.Reservations[0].Instances[0];
          
            // add the default classes
            if (config.default &&
                config.default.length > 0)
            {
              req.log('Adding default classes: ' + config.default.join(', '));
              res.addClasses(config.default);
            }
  
            //
            // map security groups to classes
            //
  
            if (info.SecurityGroups && config.securityGroups) {
              info.SecurityGroups.forEach(function (sg) {
                if (config.securityGroups[sg.GroupName] &&
                    config.securityGroups[sg.GroupName].length > 0)
                {
                  req.log('Adding security group classes: ' + config.securityGroups[sg.GroupName].join(', '));
                  res.addClasses(config.securityGroups[sg.GroupName]);
                }
              });
            }
  
            //
            // map instance type to classes
            //
            if (config.instanceTypes &&
                config.instanceTypes[info.InstanceType] &&
                config.instanceTypes[info.InstanceType].length > 0)
            {
              req.log('Adding instance type classes: ' + config.instanceTypes[info.InstanceType].join(', '));
              res.addClasses(config.instanceTypes[info.InstanceType]);
            }
  
            //
            // map tags to classes
            // also, if config.classTag is set, use that tag value
            // as additional classes
            //
  
            if (info.Tags) {
              info.Tags.forEach(function (tag) {
                if (config.classTag &&
                    config.classTag === tag.Key)
                {
                  req.log('Adding ' + config.classTag + ' tag classes: ' + tag.Value.split(/\s*,\s*/).join(', '));
                  res.addClasses(tag.Value.split(/\s*,\s*/));
                }

                if (config.tags[tag.Key] &&
                    config.tags[tag.Key][tag.Value] &&
                    config.tags[tag.Key][tag.Value].length > 0)
                {
                  req.log('Adding ' + tag.Key + ' tag classes: ' + config.tags[tag.Key][tag.Value].join(', '));
                  res.addClasses(config.tags[tag.Key][tag.Value]);
                }

                if (tag.Key === 'environment') {
                  req.log('Setting environment from ' + tag.Key + ' tag: ' + tag.Value);
                  res.environment = tag.Value;
                }
              });
            }
  
            req.log('Finished ec2 classification');
            next();
          }
        });
      } else {
        // not an EC2 node, so leave classification to something else
        next();
      }
    });
  };
};

  
