"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

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

let appSecurityGroup = new aws.ec2.SecurityGroup("app-security-group", {
  vpcId: vpc.id,
  description: "Enables access to application ports",
  ingress: [
    {
      protocol: "tcp",
      fromPort: ssh_port,
      toPort: ssh_port,
      cidrBlocks: [internetgtCidr],
    }, // SSH
    {
      protocol: "tcp",
      fromPort: HTTP_port,
      toPort: HTTP_port,
      cidrBlocks: [internetgtCidr],
    }, // HTTP
    {
      protocol: "tcp",
      fromPort: HTTPS_port,
      toPort: HTTPS_port,
      cidrBlocks: [internetgtCidr],
    }, // HTTPS
    {
      protocol: "tcp",
      fromPort: App_port,
      toPort: App_port,
      cidrBlocks: [internetgtCidr],
    }, // App Port
  ],
  egress: [
    {
      fromPort: mysql_port,
      toPort: mysql_port,
      protocol: "tcp",
      cidrBlocks: [internetgtCidr],
    },
  ],
});

exports.securityGroupName = appSecurityGroup.name;
let dbSecurityGroup = new aws.ec2.SecurityGroup("db-security-group", {
  vpcId: vpc.id,
  description: "Database security group",
  ingress: [
    {
      protocol: "tcp",
      fromPort: mysql_port, // Change port depending on the RDBMS you're using (5432 for PostgreSQL)
      toPort: mysql_port,
      securityGroups: [appSecurityGroup.id], // Traffic source is the app security group
    },
  ],
  egress: [
    {
      // Restricting access to internet
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: [internetgtCidr],
    },
    {
      fromPort: App_port,
      toPort: App_port,
      protocol: "tcp",
      securityGroups: [appSecurityGroup.id],
    },
  ],
});

exports.dbSecurityGroupName = dbSecurityGroup.name;

// Assuming a list of subnetIds for your private subnets.
//let privateSubnetsIds = ["privateSubnets"]; // replace with your actual subnet ids

let privateSubnetIds = privateSubnets.map((subnet) => subnet.id);
// Create RDS DB subnet group
const dbSubnetGroup = new aws.rds.SubnetGroup("mydbsubnetgroup", {
  subnetIds: privateSubnetIds,
});

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
  address=${rds_instance.address};
  dialect=${db_engine};
  name=${db_name};
  cd /opt/csye6225
  sudo touch .env
  echo "DB_USER=\${username}" >> .env
  echo "DB_PASSWORD=\${password}" >> .env
  echo "DB_HOST=\${address}" >> .env
  echo "DB_DIALECT=\${dialect}" >> .env
  echo "DB_NAME=\${name}" >> .env

  sudo chown -R csye6225:csye6225 /opt/csye6225`;

const publicSubnetID = publicSubnets.publicSubnet;
// Creating the EC2 instance
const instance = new aws.ec2.Instance("webapp", {
  // Use custom AMI provided through configuration
  ami: amiID,
  vpcSecurityGroupIds: [appSecurityGroup.id],
  instanceType: instanceType,
  subnetId: publicSubnets[0].id,
  ebsBlockDevices: [
    {
      deviceName: "/dev/xvda",
      volumeSize: 25,
      volumeType: "gp2",
      deleteOnTermination: true,
    },
  ],
  disableApiTermination: false,

  keyName: keyName,
  // Associate public IP address with instance within the VPC
  associatePublicIpAddress: true,
  userData: dbConfig,
  tags: {
    Name: "Cloud_WebApp_Instance",
  },
});
