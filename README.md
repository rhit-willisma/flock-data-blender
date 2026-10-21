# running script
the package manager used for this project is pnpm. use `pnpm install` to install the dependencies.

for running the script. running `node analyze.js` is sufficient for doing all the analysis.
the source data is automatically downloaded. 

## optional environment variables 
`LAT` and `LON` can be set to a latitude and longitude respectivly.
`LOCATION_DEFER` can be used to ignore the `LAT` and `LON` environment variables when running.

# data

## sources
- [census data](https://www.census.gov/data/tables/time-series/demo/popest/2020s-state-total.html)
    - [table](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv)
- [deflock](https://deflock.org/)
    - [deflock geojson data](https://data.dontgetflocked.com/cameras.geojson.gz)
- [geojson places library](https://github.com/rapomon/geojson-places)
    - [polygon data](https://www.naturalearthdata.com/features/)
- [state list](https://textlists.info/geography/list-of-u-s-states/)