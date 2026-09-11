# weaverly

set up weaverly exactly from the zip and improve that.
note that app needs fundamentally separate generation engines for:
- ascii
- cross-stitch
- weaving
- lace
- beadwork
because they each obey COMPLETELY different structural grammars

like:
ascii = terminal flow logic
cross-stitch = discrete embroidery lattice
weaving = over-under thread simulation
lace = recursive radial connectivity
beadwork = clustered bead topology

so let's build the cross stitch one first.
--
the current “cross-stitch” generation mode is incorrect.

right now the output behaves like scattered procedural ascii symbols floating freely in space.

this does NOT resemble actual cross-stitch, embroidery, loomwork, or textile-based pattern systems.

the issue:
symbols are positioned continuously and organically rather than occupying discrete textile cells.

cross-stitch mode must instead follow strict textile grid logic.

important:
every stitch/symbol must snap to a visible or implied lattice/grid system.

cross-stitch generation should feel:

 constrained

 cellular

 woven

 repetitive

 tactile

 geometric

 thread-based

NOT:

 particle systems

 free-floating glyph clouds

 generative scatterplots

 random procedural symbol placement

implement these corrections:

 enforce discrete grid occupation

 every symbol occupies a cell

 no floating placements

 no subpixel positioning

 symbols align perfectly to rows/columns

 generate from textile logic
patterns should emerge from:

 stitch repetition

 woven density

 embroidery motifs

 tapestry structures

 loom constraints

 thread pathways

 preserve readable woven rhythm
there should be:

 negative space balance

 recurring motifs

 structured clustering

 visible stitch cadence

 directional flow

 symbol rendering
symbols should resemble:

 x stitches

 knots

 thread crossings

 embroidery marks

 woven intersections

not arbitrary decorative ascii glyph noise.

 visual references
the output should resemble:

 vintage embroidery samplers

 cross-stitch pattern books

 weaving drafts

 knitting charts

 jacquard motifs

 tapestry grids

 loom punchcards

 important structural rule
the generated piece should feel manufacturable or physically stitchable.

a viewer should believe:
“this could theoretically be embroidered or woven.”

 motion behavior
if animated:

 stitches appear sequentially

 thread paths draw continuously

 weaving propagates row-by-row

 embroidery grows organically from anchor points

avoid:

 random particle emergence

 floating glyph animation

 rendering style
prioritize:

 textile tactility

 grid coherence

 constrained geometry

 symbolic repetition

 woven structure

the system should feel like:
computational fiber arts,
not procedural ascii wallpaper.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cf09e40d-e70b-4180-a8d8-56c53ef1d987).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
