"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const route53 = require("@pulumi/aws/route53");
const { LoadBalancer } = require("@pulumi/aws/alb");

const config = new pulumi.Config();

const VPcCidr = config.require("vpc-cidr-block");
const VPcNAme = config.require("vpc-name");
const private_routeTable_name = config.require("private-rt-name");
const internetgtCidr = config.require("internet-gateway-cidr");
const public_Subnet_Prefix = config.require("publicSubPrefix");
const pvt_Subnet_Prefix = config.require("privateSubPrefix");
const public_route_name = config.require("public-route-name");
const internetgtName = config.require("internet-gateway-name");
const internetgtAttach_Name = config.require(
  "internet-gateway-attachment-name"
);
const public_routeTable_name = config.require("public-rt-name");

const publicSubAssociationPrefix = config.require(
  "public-SubAssociationPrefix"
);
const privateSubAssociationPrefix = config.require(
  "private-SubAssociationPrefix"
);
const numOfSubnets = config.require("num_of_subnets");

const ssh_port = config.require("ssh-port");
const HTTP_port = config.require("http-port");
const HTTPS_port = config.require("https-port");
const App_port = config.require("app-port");

const keyName = config.require("key-name");
const instanceType = config.require("instance-type");
const amiID = config.require("ami-ID");

const mysql_port = config.require("mysql-port");
const db_name = config.require("db-name");
const db_engine = config.require("db-engine");
const db_engine_V = config.require("db-engine_version");
const db_pass = config.require("db-password");
const db_username = config.require("db-username");
const domainName = config.require("domain-Name");
const record_type = config.require("record-type");
const policy_type = config.require("policy-type");
const record_ttl = config.require("record-ttl");

const vpc = new aws.ec2.Vpc(VPcNAme, {
  cidrBlock: VPcCidr,
  tags: {
    Name: VPcNAme,
  },
});

//Internet Gateway
const internetGateway = new aws.ec2.InternetGateway(internetgtName, {});

// Attach the Internet Gateway to VPC
const internetGatewayAttachment = new aws.ec2.InternetGatewayAttachment(
  internetgtAttach_Name,
  {
    vpcId: vpc.id,
    internetGatewayId: internetGateway.id,
  }
);

const availability_zone = pulumi.output(
  aws.getAvailabilityZones({ state: "available" })
).names;

const publicSubnets = [];
const privateSubnets = [];

let numSubnets;
if (availability_zone.length <= numOfSubnets) {
  numSubnets = availability_zone.length;
} else {
  numSubnets = numOfSubnets;
}

// availabilityZones.apply((azs) => {
//   const numSubnets = Math.min(azs.length, numOfSubnets);
// });

// Create 3 public and 3 private subnets in specified availability zones.
for (let i = 0; i < numSubnets; i++) {
  const publicSubnet = new aws.ec2.Subnet(`${public_Subnet_Prefix}${i}`, {
    vpcId: vpc.id,
    availabilityZone: availability_zone[i],
    cidrBlock: `10.0.${i * 8}.0/24`,
    mapPublicIpOnLaunch: true,
    tags: {
      Name: `${public_Subnet_Prefix}${i}`,
    },
  });
  publicSubnets.push(publicSubnet);

  const privateSubnet = new aws.ec2.Subnet(`${pvt_Subnet_Prefix}${i}`, {
    vpcId: vpc.id,
    availabilityZone: availability_zone[i],
    cidrBlock: `10.0.${i * 8 + 2}.0/24`,
    tags: {
      Name: `${pvt_Subnet_Prefix}${i}`,
    },
  });
  privateSubnets.push(privateSubnet);
}

//public route table
const publicRouteTable = new aws.ec2.RouteTable(public_routeTable_name, {
  vpcId: vpc.id,
  tags: {
    Name: public_routeTable_name,
  },
});

// Create a default route in the public route table that directs traffic to the Internet Gateway
const publicRoute = new aws.ec2.Route(public_route_name, {
  routeTableId: publicRouteTable.id,
  destinationCidrBlock: internetgtCidr,
  gatewayId: internetGateway.id,
});

// Attach all public subnets to the public route table
publicSubnets.forEach((publicSubnet, index) => {
  const subnetAssociation = new aws.ec2.RouteTableAssociation(
    `${publicSubAssociationPrefix}${index}`,
    {
      routeTableId: publicRouteTable.id,
      subnetId: publicSubnet.id,
    }
  );
});

// private route table
const privateRouteTable = new aws.ec2.RouteTable(private_routeTable_name, {
  vpcId: vpc.id,
  tags: {
    Name: private_routeTable_name,
  },
});

// Iterate through private subnets and associate them with the private route table
for (let i = 0; i < privateSubnets.length; i++) {
  const subnetAssociation = new aws.ec2.RouteTableAssociation(
    `${privateSubAssociationPrefix}${i}`,
    {
      routeTableId: privateRouteTable.id,
      subnetId: privateSubnets[i].id,
    }
  );
}

const loadBalancerSecurityGroup = new aws.ec2.SecurityGroup(
  "loadBalancerSecurityGroup",
  {
    description: "Enable HTTP/HTTPS access",
    vpcId: vpc.id,
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: [internetgtCidr],
      },
    ],
    ingress: [
      {
        protocol: "tcp",
        fromPort: HTTP_port,
        toPort: HTTP_port,
        cidrBlocks: [internetgtCidr],
      },
      {
        protocol: "tcp",
        fromPort: HTTPS_port,
        toPort: HTTPS_port,
        cidrBlocks: [internetgtCidr],
      },
    ],
  }
);

exports.securityGroupId = loadBalancerSecurityGroup.id;

const appSecurityGroup = new aws.ec2.SecurityGroup("app-security-group", {
  description: "Enables access to application ports",
  vpcId: vpc.id,
  ingress: [
    {
      protocol: "tcp",
      fromPort: ssh_port,
      toPort: ssh_port,
      // securityGroups: [loadBalancerSecurityGroup.id],
      cidrBlocks: [internetgtCidr],
    },
    {
      protocol: "tcp",
      fromPort: App_port,
      toPort: App_port,
      securityGroups: [loadBalancerSecurityGroup.id],
    },
  ],
  egress: [
    {
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: [internetgtCidr],
    },
  ],
});

//exports.securityGroupName = appSecurityGroup.name;

let dbSecurityGroup = new aws.ec2.SecurityGroup("db-security-group", {
  vpcId: vpc.id,
  description: "Database security group",
  ingress: [
    {
      protocol: "tcp",
      fromPort: mysql_port,
      toPort: mysql_port,
      securityGroups: [appSecurityGroup.id],
    },
  ],
  egress: [
    {
      // Restricting access to internet
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: [internetgtCidr],
      securityGroups: [appSecurityGroup.id],
    },
  ],
});

exports.dbSecurityGroupName = dbSecurityGroup.name;

//let privateSubnetsIds = ["privateSubnets"]; // replace with your actual subnet ids

let privateSubnetIds = privateSubnets.map((subnet) => subnet.id);
// Create RDS DB subnet group
const dbSubnetGroup = new aws.rds.SubnetGroup("mydbsubnetgroup", {
  subnetIds: privateSubnetIds,
});
const publicSubnetID = publicSubnets.publicSubnet;

const dbParameterGroup = new aws.rds.ParameterGroup("db-param-group", {
  family: "mysql8.0",
  vpcId: vpc.id,
  description: "parameter group", // Change this depending on your database (postgresql9.3 for PostgreSQL, aurora-mysql5.7 for Aurora MySQL, etc.)
  parameters: [
    {
      name: "character_set_server",
      value: "utf8",
    },
  ],
});

const rds_instance = new aws.rds.Instance("csye6225-rds-instance", {
  allocatedStorage: 20,
  dbName: db_name,
  engine: db_engine,
  engineVersion: db_engine_V,
  instanceClass: "db.t2.micro",
  parameterGroupName: dbParameterGroup.name,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  password: db_pass,
  skipFinalSnapshot: true,
  username: db_username,
  publiclyAccessible: false,
  multiAz: false,
});

exports.instanceName = rds_instance.id;

const dbConfig = pulumi.interpolate`#!/bin/bash
  username=${db_username};
  password=${db_pass};
  address=${rds_instance.address.apply((v) => `prefix${v}suffix`)};
  dialect=${db_engine};
  name=${db_name};
  cd /opt/csye6225
  sudo touch .env
  echo "DB_USER=\${username}" >> .env
  echo "DB_PASSWORD=\${password}" >> .env
  echo "DB_HOST=\${address}" >> .env
  echo "DB_DIALECT=\${dialect}" >> .env
  echo "DB_NAME=\${name}" >> .env

  sudo chown -R csye6225:csye6225 /opt/csye6225
  
  sudo touch /var/log/csye6225.log
  sudo touch /var/log/csye6225err.log
  sudo chown csye6225:csye6225 /var/log/csye6225.log
  sudo chown csye6225:csye6225 /var/log/csye6225.log


  sudo amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent.json

  sudo systemctl enable amazon-cloudwatch-agent
  sudo systemctl start amazon-cloudwatch-agent`;

const userdata64 = pulumi
  .output(dbConfig)
  .apply((text) => Buffer.from(text).toString("base64"));

const cloudWatchRole = new aws.iam.Role("cloudWatchRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: "ec2.amazonaws.com",
        },
        Effect: "Allow",
        Sid: "",
      },
    ],
  }),
});
const cloudWatchRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
  "CloudWatchAgentServerPolicyAttachment",
  {
    role: cloudWatchRole.name,
    policyArn: policy_type, // This Policy allows the CloudWatch Agent to perform specific actions.
  }
);

let instanceProfile = new aws.iam.InstanceProfile("InstanceProfile", {
  role: cloudWatchRole.name,
});

// Define launch template
const launchTemplate = new aws.ec2.LaunchTemplate("launchTemplate", {
  imageId: amiID, // Replace with your custom AMI ID
  instanceType: instanceType,
  keyName: keyName, // Replace with your AWS keyname
  networkInterfaces: [
    {
      associatePublicIpAddress: true,
      securityGroups: [appSecurityGroup.id],
    },
  ],
  userData: userdata64,
  iamInstanceProfile: {
    name: instanceProfile.name,
  },
  ebsBlockDevices: [
    {
      deviceName: "/dev/xvda",
      volumeSize: 25,
      volumeType: "gp2",
      deleteOnTermination: true,
    },
  ],
});
const targetGroup = new aws.lb.TargetGroup("targetGroup", {
  port: App_port,
  protocol: "HTTP",
  targetType: "instance",
  vpcId: vpc.id,
  healthCheck: {
    path: "/healthz",
    interval: 30,
    timeout: 10,
    healthyThreshold: 3,
    unhealthyThreshold: 2,
    matcher: "200",
  },
});

// Create EC2 Auto Scaling Group
const autoScalingGroup = new aws.autoscaling.Group("autoScalingGroup", {
  desiredCapacity: 1,
  maxSize: 3,
  minSize: 1,
  // cooldown: 60,
  vpcZoneIdentifiers: publicSubnets,
  targetGroupArns: [targetGroup.arn],
  launchTemplate: {
    id: launchTemplate.id,
  },
  tags: [
    {
      key: "Name",
      value: "asg-instance",
      propagateAtLaunch: true,
    },
  ],
});

exports.launchTemplateName = launchTemplate.name;
exports.autoScalingGroupName = autoScalingGroup.name;

const loadbalancer = new aws.lb.LoadBalancer("LoadBalancer", {
  loadBalancerType: "application",
  securityGroups: [loadBalancerSecurityGroup.id],
  subnets: publicSubnets,
  // enableDeletionProtection: false,
});

const listener = new aws.lb.Listener("listener", {
  loadBalancerArn: loadbalancer.arn,
  port: HTTP_port,
  protocol: "HTTP",
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

const scaleUpPolicy = new aws.autoscaling.Policy("scaleUpPolicy", {
  scalingAdjustment: 1,
  adjustmentType: "ChangeInCapacity",
  cooldown: 60,
  autoscalingGroupName: autoScalingGroup.name,
  policyType: "SimpleScaling",
});
const scaleUpAlarm = new aws.cloudwatch.MetricAlarm("scaleUpAlarm", {
  metricName: "CPUUtilization",
  namespace: "AWS/EC2",
  statistic: "Average",
  period: 60,
  evaluationPeriods: 5,
  threshold: 3,
  comparisonOperator: "GreaterThanThreshold",
  alarmActions: [scaleUpPolicy.arn],
  dimensions: {
    AutoScalingGroupName: autoScalingGroup.name,
  },
});

const scaleDownPolicy = new aws.autoscaling.Policy("scaleDownPolicy", {
  scalingAdjustment: -1, // negative value to scale down
  adjustmentType: "ChangeInCapacity",
  cooldown: 60,
  autoscalingGroupName: autoScalingGroup.name,
  policyType: "SimpleScaling",
});

const scaleDownAlarm = new aws.cloudwatch.MetricAlarm("scaleDownAlarm", {
  alarmDescription:
    "This metric triggers a scale down if the CPU usage is less than 3% on average over 5 minutes",
  metricName: "CPUUtilization",
  namespace: "AWS/EC2",
  statistic: "Average",
  period: 60,
  evaluationPeriods: 5,
  threshold: 1,
  comparisonOperator: "LessThanThreshold",
  alarmActions: [scaleDownPolicy.arn],
  dimensions: {
    AutoScalingGroupName: autoScalingGroup.name,
  },
});

// Get the Zone information using the domain name
const zone = aws.route53.getZone({ name: domainName }, { async: true });

// Get the hosted zone by ID.
const zoneId = aws.route53
  .getZone({ name: domainName })
  .then((zone) => zone.zoneId);

// Output the Zone ID
exports.zoneId = zone.then((z) => z.zoneId);

const record = new aws.route53.Record("A-record-domain", {
  name: domainName,
  type: record_type,
  zoneId: zoneId,
  aliases: [
    {
      name: loadbalancer.dnsName,
      zoneId: loadbalancer.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

// Export the domain name and public IP
exports.domainName = record.name;
