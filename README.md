# polywas
Cytoscape.js layout for GWAS data illustrating inter-locus relationships

Demo site included, for an in production example, take a look at the 
[CoExpression Browser](http://lovelace.cs.umn.edu/cob)!

### JSON Formatting
##### For SNP:
`{data: {id: 'v', type: 'snp', chrom: '1', start: 3500, end: 4000}}`
##### For Genes:
`{data: {id: 'a', type: 'gene', snp: 'v', chrom: '1', start: 3500, end: 3525, ldegree: 3}}`
##### For Edges:
`{data: { id: 'ad', source: 'a', target: 'd', score: 10}}`

### Layout Options
```
padding: 100, // padding around the layout
boundingBox: undefined, // constrain layout bounds; {x1, y1, x2, y2} or {x1, y1, w, h}
chromPadding: 5, // Amount of padding at the end of the chrom lines in degrees
nodeHeight: 30, // Diameter of the SNP nodes
geneOffset: 30, // Distance between stacked genes
radWidth: 0.025, // Thickness of the chromosomes lines
minEdgeScore: 3.0, // Minimum edge score to be rendered (3.0 is min val)
minNodeDegree: 1, // Minimum local degree for a node to be rendered
```
