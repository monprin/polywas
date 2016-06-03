;(function(){'use strict';
var register = function(cytoscape){
  if(!cytoscape){return;} // Can't Register if Cytoscape is Unspecified

  // Default Layout Options
  var defaults = {
    padding: 100, // Padding around the layout
    boundingBox: undefined, // Constrain layout bounds; {x1, y1, x2, y2} or {x1, y1, w, h}
    chromPadding: 5, // Ammount of padding at the end of the chrom lines in degrees
    nodeHeight: 30, // Diameter of the SNP nodes
    geneOffset: 30, // Distance between stacked genes
    radWidth: 0.025, // Thickness of the chromosomes lines
    minEdgeScore: 3.0, // Minimum edge score to be rendered (3.0 is min val)
    minNodeDegree: 1, // Minimum local degree for a node to be rendered
    logSpacing: false, // Log or linear SNP layout along chromosome
    snpSelector: '[type = "snp"]',
    geneSelector: '[type = "gene"]',
    ready: function(){}, // on layoutready
    stop: function(){} // on layoutstop
  };

  // Constructor
  // Options : Object Containing Layout Options
  function PolywasLayout(options){
    var opts = this.options = {};
    for(var i in defaults){opts[i] = defaults[i];}
    for(var i in options){opts[i] = options[i];}
  }

  // Runs the Layout
  PolywasLayout.prototype.run = function(){
    var options = this.options;
    var cy = options.cy;

    // Find the Bounding Box and the Center
    var bb = options.boundingBox || cy.extent();
    if(bb.x2 === undefined){bb.x2 = bb.x1 + bb.w;}
    if(bb.w === undefined){bb.w = bb.x2 - bb.x1;}
    if(bb.y2 === undefined){bb.y2 = bb.y1 + bb.h;}
    if(bb.h === undefined){bb.h = bb.y2 - bb.y1;}
    var center = {x:(bb.x1+bb.x2)/2, y:(bb.y1+bb.y2)/2};

    // Start the layout
    console.log('Starting Layout');
    this.trigger('layoutstart');

    // Clean up things from previous layout, if there was one
    cy.reset();
    cy.nodes().style({'display': 'element'});
    cy.remove('[type = "chrom"], [type = "snpG"]');

    // Finding and splitting up the different element types
    var nodes = cy.nodes();
    var snps = nodes.filter(options.snpSelector);
    var genes = nodes.filter(options.geneSelector);

    // Hide genes that are not above the threshold
    genes = genes.difference(genes.filter(function(i, ele){
        return (parseInt(ele.data('ldegree')) < options.minNodeDegree);
      }).style({'display': 'none'}));

    // Hide edges that are not above the threshold
    options.eles.edges().filter(function(i, ele){
        return (parseFloat(ele.data('score')) < options.minEdgeScore);
      }).style({'display': 'none'});
    console.log('Prepped Element Data');

    // ===========================
    // Find Info About Chromosomes
    // ===========================
    // Get the chrom nodes and relative SNP positions
    var res =  makeChroms(getSNPData(snps), options.logSpacing);
    var snpData = res['snpData'];

    // Add the chromosomes to the graph
    var chrom = cy.add(res['nodes']);

    // ======================
    // Handle the Chromosomes
    // ======================
    // Find circle information
    var radius = (Math.min(bb.h, bb.w)/2)-options.padding;
    var chromPad = (options.chromPadding*Math.PI)/180; // Padding in radians

    // Find and set the position of the chromosomes
    var chromData = {};
    chrom.layoutPositions(this, options, function(i, ele){
      res = positionChrom(i, ele, ((2*Math.PI)/chrom.length), chromPad, radius, center);
      chromData[ele.data('id')] = res;
      return res.pos;
    }).style({
      'shape': 'polygon',
      'width': function(ele){return ele.data('len');},
      'height': function(ele){return ele.data('len');},
      'shape-polygon-points': function(ele){
          return getLinePolygon((ele.data('theta')-(Math.PI/2)), options.radWidth);}
    }).lock();
    console.log('Placed Chromosomes');
    console.log(chromData);
    // ===============
    // Handle the SNPs
    // ===============
    // Make new snps
    res = combineSNPS(snpData, chromData, options.nodeHeight);
    var snpToGroup = res['map'];

    // Remove the raw SNPs from the graph
    snps.style({'display': 'none'});

    // Add our fresh nodes
    snps = cy.add(res['nodes']);

    // Position the new snps
    snpData = {};
    snps.layoutPositions(this, options, function(i, ele){
      var eleData = ele.data();
      var chromInfo = chromData[eleData['chrom']];
      res = positionSNP(eleData['pos'], chromInfo['pxStart'], chromInfo['delta'], options.geneOffset, center);
      snpData[eleData['id']] = res;
      return res['pos'];
    }).lock();
    console.log('Placed SNPs');

    // ================
    // Handle the genes
    // ================
    // Sort the genes by degree
    genes = genes.sort(function(a,b){
        return (b.data('ldegree') - a.data('ldegree'));
    }).layoutPositions(this, options, function(i, ele){
      var snpInfo = snpData[snpToGroup[ele.data('snp')]];
      var n = snpInfo['n'];
      snpInfo['n'] += 1;
      return {
        x: Math.round((n*snpInfo['coef']['x'])+snpInfo['pos']['x']),
        y: Math.round((n*snpInfo['coef']['y'])+snpInfo['pos']['y'])
      };
    });
    console.log('Placed Genes');

    // ==================
    // Finish the Layout!
    // ==================
    // Trigger layoutready when each node has had its position set at least once
    this.one('layoutready', options.ready);
    this.trigger('layoutready');

    // Trigger layoutstop when the layout stops (e.g. finishes)
    this.one('layoutstop', options.stop);
    this.trigger('layoutstop');

    // Done
    console.log('Finished Layout');
    return this;
  };

  // Called on Continuous Layouts to Stop Them Before They Finish
  PolywasLayout.prototype.stop = function(){return this;};

  // Actually Register the layout!
  cytoscape('layout', 'polywas', PolywasLayout);
};

// Expose as a Commonjs Module
if( typeof module !== 'undefined' && module.exports ){module.exports = register;}

// Expose as an AMD/Requirejs Module
if( typeof define !== 'undefined' && define.amd ){
  define('cytoscape-polywas', function(){return register;});}

// Expose to Global Cytoscape (i.e. window.cytoscape)
if( typeof cytoscape !== 'undefined' ){register(cytoscape);}})();


// Function to get Sorted array of SNP data from SNP nodes
function getSNPData(snps){
  // Make an array of important SNP Data for quicker access
  var snpData = [];
  snps.forEach(function(currentValue, index, array){
    var eleD = currentValue.data();
    snpData.push({
      id: eleD['id'],
      chrom: eleD['chrom'],
      pos: Math.round((parseInt(eleD['start']) + parseInt(eleD['end']))/2),
    });
  });

  // Sort that data by chromosome and position
  snpData.sort(function(a,b){
      if(a['chrom'] < b['chrom']){return -1;}
      else if(a['chrom'] > b['chrom']){return 1;}
      else{
          if(a['pos'] < b['pos']){return -1;}
          else if(a['pos'] > b['pos']){return 1;}
          else{return 0;}
  }});
  return snpData;
};

// Function that returns chrmosome objects using the SNP Data.
function makeChroms(snpData, logSpacing){
  var chromNodes = []; // Container for chomosome nodes
  var curNode = null; // Current node being built
  var curChrom = null; // Current chromosome
  var curZero = 0; // Current virtual zero point in BP
  var curPos = 0; // Current Position on literal chromosome
  var curVPos = 0; // Current position on the virtual chromosome
  var dist = 0; // Distance in BP between this SNP and last SNP
  snpData.forEach(function(currentValue, index, array){
    if(currentValue['chrom'] !== curChrom){
      // Unles it is the first run push the node onto the stack
      if(curNode !== null){chromNodes.push(curNode);}
      // Set initial values for new chromosome
      curChrom = currentValue['chrom'];
      curZero = currentValue['pos'] - 1;
      curPos = 1;
      curVPos = 1;
      curNode = {group: 'nodes', data:{
          id: currentValue['chrom'],
          type: 'chrom',
          start: 0,
          end: curVPos,
      }};
    }
    else{
      // Find the virtual position along the chrom
      dist = currentValue['pos'] - curZero - curPos;
      curPos = curPos + dist;
      if(logSpacing){curVPos = Math.round(curVPos + Math.log(dist));}
      else{curVPos = Math.round(curVPos + dist);}

      // Update the end value
      curNode['data']['end'] = curVPos;
    }
    // Set the virtual position of the SNP
    currentValue['vpos'] = curVPos;
  });
  // Push the last built node
  chromNodes.push(curNode);
  return {snpData: snpData, nodes: chromNodes};
};

function positionChrom(i, ele, dtheta, chromPad, radius, center){
  // Find the angle of the ends of the chrom line
  var radA = ((i-1)*dtheta)+(chromPad/2);
  var radB = ((i)*dtheta)-(chromPad/2);

  // Use trig to find the actual coordinates of the points
  var ax = Math.round((radius * Math.cos(radA)) + center['x']);
  var ay = Math.round((radius * Math.sin(radA)) + center['y']);
  var bx = Math.round((radius * Math.cos(radB)) + center['x']);
  var by = Math.round((radius * Math.sin(radB)) + center['y']);

  // Find the two relevant measures of line length, pixels and base pairs
  var chromLen = ele.data('end')-ele.data('start');
  var pxLen = Math.sqrt((ax-bx)*(ax-bx) + (ay-by)*(ay-by));

  // Add some information in the node concerning it's position
  ele.data({
    len: pxLen, // Total length in pixels
    theta: (radA+radB)/2, // Radian of midpoint from center
  });
  return {
    pos: {x: Math.round((ax+bx)/2), y: Math.round((ay+by)/2)},
    pxStart: {x:ax, y:ay},
    delta: {x:((bx-ax)/chromLen), y:((by-ay)/chromLen)},
    BPperPX: (chromLen/pxLen)
  };
};

// Helper function that, given theta, returns the polygon points for a line oriented
// in that direction in relation to the origin (0,0) of the unit circle
function getLinePolygon(theta, radWidth){
  var ax = Math.cos(theta+(radWidth/2)); var ay = Math.sin(theta+(radWidth/2));
  var bx = Math.cos(theta-(radWidth/2)); var by = Math.sin(theta-(radWidth/2));
  var cx = -ax; var cy = -ay;
  var dx = -bx; var dy = -by;
  var res = ax.toString() + ' ' + ay.toString() + ' '
    + bx.toString() + ' ' + by.toString() + ', '
    + bx.toString() + ' ' + by.toString() + ' '
    + cx.toString() + ' ' + cy.toString() + ', '
    + cx.toString() + ' ' + cy.toString() + ' '
    + dx.toString() + ' ' + dy.toString() + ', '
    + dx.toString() + ' ' + dy.toString() + ' '
    + ax.toString() + ' ' + ay.toString();
  return res;
};

function combineSNPS(snpData, chromData, nodeHeight){
  // Containers for derived vals
  var snpNodes = [];
  var snpToGroup = {};

  // Variables for use during processing
  var curNode = null;
  var curChrom = null;
  var totDist = 0;
  var lastPos = 0;
  var idNum = -1;

  // Run through each SNP!
  snpData.forEach(function(currentValue, index, array){
      totDist = totDist + (currentValue['vpos'] - lastPos);
      lastPos = currentValue['vpos'];
      // Need to start a new node
      if((currentValue['chrom'] !== curChrom) || (totDist >= (nodeHeight*chromData[curChrom]['BPperPX']))){
          // Push the last node, find the position of it in virtual BP
          if(curNode !== null){
            curNode['data']['pos'] = (curNode['data']['start']+curNode['data']['end'])/2;
            snpNodes.push(curNode);}

          // Set the new intial values
          idNum = idNum + 1;
          totDist = 0;
          curChrom = currentValue['chrom'];
          curNode = {group: 'nodes', data:{
              id: ('SNPG:' + idNum.toString()),
              type: 'snpG',
              chrom: curChrom,
              start: lastPos,
              end: lastPos,
              snps: [],
          }};
      }
      // Otherwise just update the end position
      else{curNode['data']['end'] = lastPos;}

      // Update the SNP maps
      curNode['data']['snps'].push(currentValue['id']);
      snpToGroup[currentValue['id']] = ('SNPG:' + idNum.toString());
  });

  // Push the last built node
  curNode['data']['pos'] = (curNode['data']['start']+curNode['data']['end'])/2;
  snpNodes.push(curNode);

  // Return the stuff!
  return {nodes: snpNodes, map:snpToGroup};
};

function positionSNP(vpos, chromPos, delta, geneOffset, center){
  // Find the position of the snps based on all the data
  var x = Math.round((vpos*delta['x'])+chromPos['x']);
  var y = Math.round((vpos*delta['y'])+chromPos['y']);

  // Save these to the object
  var theta = Math.atan2((y-center['y']),(x-center['x']));
  return{
    pos: {x:x, y:y},
    coef: {x:(Math.cos(theta)*geneOffset), y:(Math.sin(theta)*geneOffset)},
    n: 1};
};
