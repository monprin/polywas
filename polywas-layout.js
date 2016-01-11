;(function(){ 'use strict';
var register = function(cytoscape){
  if(!cytoscape){return;} // Can't Register if Cytoscape is Unspecified

  var isString = function(o){ return typeof o === typeof ''; };
  var isNumber = function(o){ return typeof o === typeof 0; };
  var isObject = function(o){ return o != null && typeof o === typeof {}; };

  // Default Layout Options
  var defaults = {
    padding: 30, // padding around the layout
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    locusPadding: 7.5, //Ammount of padding at the end of the locus lines (in degrees)

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
    // Making some convinience aliases
    var layout = this;
    var options = this.options;
    var cy = options.cy; // The whole environment
    var eles = options.eles; // elements to consider in the layout
    var locusPad = (options.locusPadding*Math.PI)/180; // Padding in radians around locusuences

    // Finding and splitting up the different element types
    var nodes = eles.nodes();
    var loci = nodes.filter('[type = "locus"]').sort(options.sort);
    var genes = nodes.filter('[type = "gene"]').sort(options.sort);
    var coex = eles.edges();

    // Find the Bounding Box and the Center
    var bb = options.boundingBox || {x1:0, y1:0, w:cy.width(), h:cy.height()};
    if(bb.x2 === undefined){bb.x2 = bb.x1 + bb.w;}
    if(bb.w === undefined){bb.w = bb.x2 - bb.x1;}
    if(bb.y2 === undefined){bb.y2 = bb.y1 + bb.h;}
    if(bb.h === undefined){bb.h = bb.y2 - bb.y1;}
    var center = {x:(bb.x1+bb.x2)/2, y:(bb.y1+bb.y2)/2};

    // Set up the circle in which to place the locusuences
    var circum = 2*Math.PI;
    var radius = (Math.min(bb.h, bb.w)/2)-options.padding;

    // Find how many radians each locusuence gets
    var locusCount = loci.length;
    var dtheta = circum/locusCount;

    // Start the actual laying out
    layout.trigger('layoutstart');

    // =================
    // Position the Loci
    // =================
    // Error if there are less than two loci
    try{if(locusCount < 2){
      throw "Locus layout doeesn't make sense with less than 2 Loci.\nPlease add more loci and try again.";}}
    catch(err){window.alert(err);}

    // Find the and set the position of the loci
    loci.layoutPositions(this, options, (function(i, ele){
      // Find the angle of the ends of the locus line
      var radA = ((i-1)*dtheta)+(locusPad/2);
      var radB = ((i)*dtheta)-(locusPad/2);

      // Use trig to find the actual coordinates of the points
      var ax = Math.round((radius * Math.cos(radA)) + center.x);
      var ay = Math.round((radius * Math.sin(radA)) + center.y);
      var bx = Math.round((radius * Math.cos(radB)) + center.x);
      var by = Math.round((radius * Math.sin(radB)) + center.y);

      // Find the midpoint of the line (where it will actually be positioned
      var mx = Math.round((ax+bx)/2);
      var my = Math.round((ay+by)/2);

      // Find the two relevant measures of line length, pixels and base pairs
      var locusLen = ele.data('end')-ele.data('start');
      var pxLen = Math.sqrt((ax-bx)*(ax-bx) + (ay-by)*(ay-by));

      // Add some information in the node concerning it's position
      ele.data({
        pxStart: {x:ax, y:ay}, // The starting pixel
        pxEnd: {x:bx, y:by}, // THe ending pixel
        mid: {x:mx, y:my}, // The middle pixel
        delta: {x:((bx-ax)/locusLen), y:((by-ay)/locusLen)}, // Pixels per basepair
        len: pxLen, // Total length in pixels
        theta: (radA+radB)/2, // Radian of midpoint from center
        radius: radius,
        center: center,
      });
      return ele.data('mid');
    }));

    // ===============
    // Make Loci Lines
    // ===============
    cy.style().selector('[type = "locus"]').style({
      'shape': 'polygon',
      'width': function(ele){return ele.data('len');},
      'height': function(ele){return ele.data('len');},
      'shape-polygon-points': function(ele){
          var theta = (ele.data('theta')-(Math.PI/2));
          // Calls helper function (at bottom) for getting the polygon points
          return getLinePolygon(theta);
      },
    }).update();

    // =================
    // Position the genes
    // =================
    var orphanGenes = [];
    genes.layoutPositions(this, options, (function(i, ele){
      // Find information about the parent
      var parent = loci.filter(('[id = "'+ele.data('locus')+'"]'));
      // Put orphan genes in the middle of the graph
      if(parent.length !== 1){
        orphanGenes[orphanGenes.length] = ele.data('id');
        return {x:center.x, y:center.y};
      }
      var parPos = parent.data('pxStart');
      var delta = parent.data('delta');

      // Find the start and end position of genes
      var start = ele.data('start');
      var end = ele.data('end');

      // Find the position of the genes based on all the data
      return {
        x: ((((start*delta.x)+(end*delta.x))/2)+parPos.x),
        y: ((((start*delta.y)+(end*delta.y))/2)+parPos.y),
      };
    }));

    // Throw up an alert if there are orphan genes
    try{if(orphanGenes.length > 0){
      throw "You have genes with either more or less than one parent locus, they are in the middle of the graph, please fix this for correct formatting. The affected genes are:\n";}}
    catch(err){
      var geneStr = '';
      for(var i=0; i < orphanGenes.length; i++){
        geneStr += orphanGenes[i] + '\n';}
      window.alert(err + geneStr);
    }

    // Trigger layoutready when each node has had its position set at least once
    layout.one('layoutready', options.ready);
    layout.trigger('layoutready');

    // Trigger layoutstop when the layout stops (e.g. finishes)
    layout.one('layoutstop', options.stop);
    layout.trigger('layoutstop');

    return this; // chaining
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

// Helper function that, given theta, returns the polygon points for a line oriented
// in that direction in relation to the origin (0,0) of the unit circle
var getLinePolygon = function(theta, radWidth){
  var radWidth = radWidth || 0.015;
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
