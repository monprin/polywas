# polywas
Cytoscape.js layout for GWAS data illustrating inter-locus relationships

Demo site included, for an in production example, take a look at the 
[CoExpression Browser](http://lovelace.cs.umn.edu/cob)!

### JSON Formatting
##### For Genes:
`{data:{id: 'a', snp: 'v', chrom: '1', start: 3500, end: 3525}}`
##### For Edges:
`{data:{id: 'ad', source: 'a', target: 'd'}}`

### Layout Options
```
padding: 100, // Padding around the layout
boundingBox: undefined, // Constrain layout bounds; {x1,y1,x2,y2} or {x1,y1,w,h}
chromPadding: 5, // Ammount of padding at the end of the chrom lines in degrees
nodeDiameter: 30, // Diameter of the genes, for stacking and spacing
radWidth: 0.015, // Thickness of the chromosomes lines (in radians)
logSpacing: false, // Log or linear SNP layout along chromosome
snpLevels: 3, // How many colors to stripe the snps

// Defines which chromosome the gene is on
getChrom: function(ele){return ele.data('chrom');},

// Defines which SNP the gene is on
getSNP: function(ele){return ele.data('snp');},

// Defines the gene's starting and ending positions (in base pairs)
getStart: function(ele){return ele.data('start');}, 
getEnd: function(ele){return ele.data('end');},
```
