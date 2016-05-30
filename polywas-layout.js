;(function(){'use strict';
var register = function(cytoscape){
  if(!cytoscape){return;} // Can't Register if Cytoscape is Unspecified

  // Default Layout Options
  var defaults = {
    padding: 100, // Padding around the layout
    boundingBox: undefined, // Constrain layout bounds: {x1, y1, x2, y2} or {x1, y1, w, h}
    chromPadding: 5, //Ammount of padding at the end of the chrom lines in degrees
    nodeHeight: 30, // Diameter of the SNP nodes
    geneOffset: 30, // Distance between stacked genes
    radWidth: 0.025, // Thickness of the chromosomes lines
    minEdgeScore: 3.0, // Minimum edge score to be rendered (3.0 is min val)
    minNodeDegree: 1, // Minimum local degree for a node to be rendered
    ready: function(){}, // on layoutready
    stop: function(){} // on layoutstop
  };

  // Constructor
  // Options : Object Containing Layout Options
  function PolywasLayout( options ){
    var opts = this.options = {};
    for( var i in defaults ){ opts[i] = defaults[i]; }
    for( var i in options ){ opts[i] = options[i]; }
  }

  // Runs the Layout
  PolywasLayout.prototype.run = function(){
    console.log('Started Layout');
    // Making some convinience/speed aliases
    var layout = this;
    var options = this.options;
    var cy = options.cy; // The whole environment
    var eles = options.eles; // elements to consider in the layout
    var nodes = eles.nodes();
    var chromPad = (options.chromPadding*Math.PI)/180; // Padding in radians around chromuences
    var geneOffset = options.geneOffset;
    var radWidth = options.radWidth;
    var minNodeDegree = options.minNodeDegree;
    var minEdgeScore = options.minEdgeScore;
    
    // Clean up things from previous layout
    cy.reset();
    nodes.filter('[type = "snpG"]').remove();
    eles.style({'display': 'element'});
    
    // Finding and splitting up the different element types
    var chrom = nodes.filter('[type = "chrom"]').sort(options.sort);
    var snps = nodes.filter('[type = "snp"]');
    var genes = nodes.filter('[type = "gene"]');
    
    // Hide genes that are not above the threshold
    genes = genes.difference(genes.filter(function(i, ele){
        return (parseInt(ele.data('ldegree')) < minNodeDegree);
      }).style({'display': 'none'}));
    
    // Hide edges that are not above the threshold
    eles.edges().filter(function(i, ele){
        return (parseFloat(ele.data('score')) < minEdgeScore);
      }).style({'display': 'none'});
    
    // Find the Bounding Box and the Center
    var bb = options.boundingBox || cy.extent();
    if(bb.x2 === undefined){bb.x2 = bb.x1 + bb.w;}
    if(bb.w === undefined){bb.w = bb.x2 - bb.x1;}
    if(bb.y2 === undefined){bb.y2 = bb.y1 + bb.h;}
    if(bb.h === undefined){bb.h = bb.y2 - bb.y1;}
    var center = {x:(bb.x1+bb.x2)/2, y:(bb.y1+bb.y2)/2};

    // Set up the circle in which to place the chromuences
    var circum = 2*Math.PI;
    var radius = (Math.min(bb.h, bb.w)/2)-options.padding;
    
    // Find how many radians each chrom gets
    var chromCount = chrom.length;
    var dtheta = circum/chromCount;

    // Start the actual laying out
    console.log('Set metadata and filtered.');
    layout.trigger('layoutstart');

    // ======================
    // Handle the Chromosomes
    // ======================
    // Find and set the position of the chromosomes
    var chromData = {};
    chrom.layoutPositions(layout, layout.options, function(i, ele){
      var res = positionChrom(i, ele, dtheta, chromPad, radius, center);
      chromData[ele.data('id')] = res;
      return res.pos;
    }).lock();

    // Set the style for each chromosome to make them into the line
    cy.style().selector('[type = "chrom"]').style({
      'shape': 'polygon',
      'width': function(ele){return ele.data('len');},
      'height': function(ele){return ele.data('len');},
      'shape-polygon-points': function(ele){
          return getLinePolygon((ele.data('theta')-(Math.PI/2)), radWidth);}
    }).update();
    console.log('Placed Chromosomes');

    // ===============
    // Handle the SNPs
    // ===============
    // Extract the data from the SNPS
    var snpData = getSNPData(snps);
      
    // Make new snps
    var res = combineSNPS(cy, snpData, options.nodeHeight, genes, snps, chromData);
    var snpToGroup = res['map'];
    
    // Remove the raw SNPs from the graph
    snps.style({'display': 'none'});
    
    // Add our fresh nodes
    snps = cy.add(res['nodes']);
    
    // Position the new snps
    snpData = {};
    snps.layoutPositions(layout, layout.options, function(i, ele){
      var eleData = ele.data()
      var chromInfo = chromData[eleData['chrom']];
      var res = positionSNP(eleData['start'], eleData['end'], chromInfo['pxStart'], chromInfo['delta'], geneOffset, center);
      snpData[eleData['id']] = res;
      return res.pos;
    }).lock();
    console.log('Placed SNPs');

    // ================
    // Handle the genes
    // ================
    // Sort the genes by degree
    genes = genes.sort(function(a,b){
        var ad = a.degree();
        var bd = b.degree();
        if(ad < bd){return 1;}
        else if(ad > bd){return -1;}
        else{return 0;}
    });
    
    // Lay them out based on the data about snps
    genes.layoutPositions(layout, layout.options, function(i, ele){
      var snpInfo = snpData[snpToGroup[ele.data('snp')]];
      var n = snpInfo['n']
      snpInfo['n'] += 1;
      return {
        x: Math.round((n*snpInfo['coef']['x'])+snpInfo['pos']['x']),
        y: Math.round((n*snpInfo['coef']['y'])+snpInfo['pos']['y'])
      };
    });
    console.log('Placed the Genes');
    
    // ==================
    // Finish the Layout!
    // ==================
    // Trigger layoutready when each node has had its position set at least once
    layout.one('layoutready', options.ready);
    layout.trigger('layoutready');

    // Trigger layoutstop when the layout stops (e.g. finishes)
    layout.one('layoutstop', options.stop);
    layout.trigger('layoutstop');
    
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

function positionChrom(i, ele, dtheta, chromPad, radius, center){
  // Find the angle of the ends of the chrom line
  var radA = ((i-1)*dtheta)+(chromPad/2);
  var radB = ((i)*dtheta)-(chromPad/2);

  // Use trig to find the actual coordinates of the points
  var ax = Math.round((radius * Math.cos(radA)) + center.x);
  var ay = Math.round((radius * Math.sin(radA)) + center.y);
  var bx = Math.round((radius * Math.cos(radB)) + center.x);
  var by = Math.round((radius * Math.sin(radB)) + center.y);

  // Find the midpoint of the line (where it will actually be positioned
  var mx = Math.round((ax+bx)/2);
  var my = Math.round((ay+by)/2);

  // Find the two relevant measures of line length, pixels and base pairs
  var chromLen = ele.data('end')-ele.data('start');
  var pxLen = Math.sqrt((ax-bx)*(ax-bx) + (ay-by)*(ay-by));

  // Add some information in the node concerning it's position
  ele.data({
    len: pxLen, // Total length in pixels
    theta: (radA+radB)/2, // Radian of midpoint from center
  });
  return {pos:{x:mx, y:my}, pxStart:{x:ax, y:ay}, delta:{x:((bx-ax)/chromLen), y:((by-ay)/chromLen)}, BPperPX: (chromLen/pxLen)};
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

function getSNPData(snps){
  var snpData = []
  snps.forEach(function(currentValue, index, array){
    var eleD = currentValue.data();
    var start = parseInt(eleD['start']);
    var end =  parseInt(eleD['end']);
    snpData.push({id: eleD['id'], chrom: eleD['chrom'], start: start, end: end, pos: ((start + end)/2)});
  });
  
  // Sort that data by chromasome and position
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

function combineSNPS(cy, snpData, nodeHeight, genes, snps, chromData){
  // Make new nodes from these
  var snpNodes = [];
  var idNum = -1;
  var snpToGroup = {};
  var curGID = null;
  var curNode = null;
  var curChrom = null;
  var lastPos = 0;
  var totDist = 0;
  var first = true;
  var newID = null;
  var newChrom = null;
  var newPos = null;
  snpData.forEach(function(currentValue, index, array){
      totDist = totDist + (currentValue['pos'] - lastPos);
      newID = currentValue['id'];
      newChrom = currentValue['chrom'];
      lastPos = currentValue['pos'];
      // Need to start a new node
      if(first || (newChrom !== curChrom) || (totDist >= (nodeHeight*chromData[curChrom]['BPperPX']))){
          // Push the last node
          if(curNode !== null){snpNodes.push(curNode);}
          else{first = false;}
          
          // Set the new intial values
          idNum = idNum + 1;
          totDist = 0;
          curGID = ('SNPG:' + idNum.toString())
          curChrom = newChrom;
          curNode = {group: 'nodes', data:{
              id: curGID,
              type: 'snpG',
              chrom: newChrom,
              start: currentValue['start'],
              end: currentValue['end'],
              snps: []}};
      }
      else{
          // Set the max and min vals
          currentValue['start'] = Math.min(currentValue['start'], curNode['data']['start']);
          currentValue['end'] = Math.max(currentValue['end'], curNode['data']['end']);
      }
      
      // Update the SNP maps
      curNode['data']['snps'].push(newID);
      snpToGroup[newID] = curGID;
  });
  
  // Push the last built node
  snpNodes.push(curNode);
  return {nodes: snpNodes, map:snpToGroup};
};

function positionSNP(start, end, chromPos, delta, geneOffset, center){
  // Find the position of the snps based on all the data
  var x = Math.round((((start*delta['x'])+(end*delta['x']))/2)+chromPos['x']);
  var y = Math.round((((start*delta['y'])+(end*delta['y']))/2)+chromPos['y']);
  
  // Save these to the object
  var theta = Math.atan2((y-center['y']),(x-center['x']));
  return{
    pos: {x:x, y:y},
    coef: {x:(Math.cos(theta)*geneOffset), y:(Math.sin(theta)*geneOffset)},
    n: 1};
};