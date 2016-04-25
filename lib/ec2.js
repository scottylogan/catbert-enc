var aws      = require('aws-sdk'),
    ec2      = new aws.EC2({region: aws.config.region || 'us-west-2'}),
    ec2Map   = require('../ec2.json');
    

exports = module.exports = function ec2Classifier (req, res, next) {
  var filters = [],
      errors = [],
      re = new RegExp('^ip-(\\d+(-\\d+){3})\\.(' + req.domain.replace(/\./g,'\\.') + '|[^\\.]+\\.compute\\.internal)$'),
      match;

  // check for internal names
  // usually ip-a-b-c-d.region.compute.internal, but if
  // a custom DHCP option set with a custom domain is used
  // it will be ip-a-b-c-d.custom-domain
  //
  // the custom domain makes it easier for nodes to find
  // the puppet master

  //  match = req.node.match(/^ip-(\d+(-\d+){3})\.(catbert\.net|[^\.]+\.compute\.internal)$/);
  match = req.node.match(re);
  if (match) {
    if (match[3] === req.domain) {
      // need to match on private IP rather than name
      filters.push({ Name: 'private-ip-address', Values: [ match[1].replace(/-/g, '.') ] });
    } else {
      // can match on given name
      filters.push({ Name: 'private-dns-name', Values: [ req.node ] });
    }
  }
    
  // check for public names
  // usually ec2-a-b-c-d.region.compute.amazonaws.com
  
  match = req.node.match(/^ec2-\d+(-\d+){3}\.[^\.]+\.compute\.amazonaws\.com$/);
  if (match) {
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
        if (ec2Map.default) {
          res.classes.push(ec2Map.default);
        }

        //
        // map security groups to classes
        //

        if (info.SecurityGroups && ec2Map.securityGroups) {
          info.SecurityGroups.forEach(function (sg) {
            if (ec2Map.securityGroups[sg.GroupName]) {
              res.classes.push(ec2Map.securityGroups[sg.GroupName]);
            }
          });
        }

        //
        // map instance type to classes
        //
        if (ec2Map.instanceTypes && ec2Map.instanceTypes[info.InstanceType]) {
          res.classes.push(ec2Map.instanceTypes[info.InstanceType]);
        }

        //
        // map tags to classes
        // also, if ec2Map.classTag is set, use that tag value
        // as additional classes
        //

        if (info.Tags) {
          info.Tags.forEach(function (tag) {
            if (ec2Map.classTag && ec2Map.classTag == tag.Key) {
            res.classes.push(tag.Value.split(/\s*,\s*/));
            }
            if (ec2Map.tags[tag.Key] && ec2Map.tags[tag.Key][tag.Value]) {
              res.classes.push(ec2Map.tags[tag.Key][tag.Value]);
            }
            if (tag.Key === 'environment') {
              res.environment = tag.Value;
            }
          });
        }

        next();
      }
    });
  } else {
    // not an EC2 node, so leave classification to something else
    next();
  }
}

