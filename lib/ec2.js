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
          console.log('Node is in custom domain');
          // need to match on private IP rather than name
          filters.push({ Name: 'private-ip-address', Values: [ match[1].replace(/-/g, '.') ] });
        } else {
          console.log('Node is using a private EC2 address');
          // can match on given name
          filters.push({ Name: 'private-dns-name', Values: [ req.node ] });
        }
      }

      // check for public names
      // usually ec2-a-b-c-d.region.compute.amazonaws.com
    
      match = req.node.match(/^ec2-\d+(-\d+){3}\.[^\.]+\.compute\.amazonaws\.com$/);
      if (match) {
        console.log('Node is using a public EC2 address');
        filters.push({ Name: 'public-dns-name', Values: [ req.node ]});
      }
  
      // if any of the names matched EC2-ish names, we'll have a filter
      // for describeInstances.
  
      if (filters.length > 0) {
        ec2.describeInstances({Filters: filters}, function (err, info) {
          if (err) {
            next(err);
          } else if (info.Reservations.length === 1 || info.Reservations[0].Instances.length === 1) {
            // we have EC2 instance data to use for classification
  
            info = info.Reservations[0].Instances[0];
          
            // add the default classes
            if (config.default) {
              console.log('Adding default classes:', config.default.join(', '));
              res.classes.push(config.default);
            }
  
            //
            // map security groups to classes
            //
  
            if (info.SecurityGroups && config.securityGroups) {
              info.SecurityGroups.forEach(function (sg) {
                if (config.securityGroups[sg.GroupName]) {
                  console.log('Adding security group classes:', config.securityGroups[sg.GroupName].join(', '));
                  res.classes.push(config.securityGroups[sg.GroupName]);
                }
              });
            }
  
            //
            // map instance type to classes
            //
            if (config.instanceTypes && config.instanceTypes[info.InstanceType]) {
              res.classes.push(config.instanceTypes[info.InstanceType]);
            }
  
            //
            // map tags to classes
            // also, if config.classTag is set, use that tag value
            // as additional classes
            //
  
            if (info.Tags) {
              info.Tags.forEach(function (tag) {
                if (config.classTag && config.classTag == tag.Key) {
                  res.classes.push(tag.Value.split(/\s*,\s*/));
                }
                if (config.tags[tag.Key] && config.tags[tag.Key][tag.Value]) {
                  res.classes.push(config.tags[tag.Key][tag.Value]);
                }
                if (tag.Key === 'environment') {
                  res.environment = tag.Value;
                }
              });
            }
  
            console.error('finished ec2 classification');
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

  
