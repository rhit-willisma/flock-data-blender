import {readFile, writeFile, existsSync, createWriteStream, mkdir} from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { lookUpRaw } from "geojson-places";
import ExcelJS from "exceljs"
import ansi from "ansi"
import { get_location_or_ask } from "./geohelper/geohelper.js";

try {
    process.loadEnvFile()
} catch {}

const cursor = ansi(process.stdout)
const PI = 3.14159
const RADIUS = 3959.0

String.prototype.splice = function(...args){return Array.from(this).splice(...args).join("")}

async function assure_structure(){
    const struct = [
        "./source_data",
        "./synth_data",
        "./generated_tables"
    ]
    for (let dir of struct) mkdir(dir, {recursive: true}, err=>{if(err) console.error(err)})
}

async function download_sources(){
    if (existsSync("source_data")) {
        console.info("sources are already downloaded, continuing")
        return
    }
    console.info("downloading sources...")
    const sources = [
        {
            "url": "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv",
            "filename": "NST-EST2025-ALLDATA.csv"
        },
        {
            "url": "https://data.dontgetflocked.com/cameras.geojson.gz",
            "filename": "cameras.geojson"
        },
        {
            "url": "data:text/plain;base64,QWxhYmFtYQpBbGFza2EKQXJpem9uYQpBcmthbnNhcwpDYWxpZm9ybmlhCkNvbG9yYWRvCkNvbm5lY3RpY3V0CkRlbGF3YXJlCkZsb3JpZGEKR2VvcmdpYQpIYXdhaWkKSWRhaG8KSWxsaW5vaXMKSW5kaWFuYQpJb3dhCkthbnNhcwpLZW50dWNreQpMb3Vpc2lhbmEKTWFpbmUKTWFyeWxhbmQKTWFzc2FjaHVzZXR0cwpNaWNoaWdhbgpNaW5uZXNvdGEKTWlzc2lzc2lwcGkKTWlzc291cmkKTW9udGFuYQpOZWJyYXNrYQpOZXZhZGEKTmV3IEhhbXBzaGlyZQpOZXcgSmVyc2V5Ck5ldyBNZXhpY28KTmV3IFlvcmsKTm9ydGggQ2Fyb2xpbmEKTm9ydGggRGFrb3RhCk9oaW8KT2tsYWhvbWEKT3JlZ29uClBlbm5zeWx2YW5pYQpSaG9kZSBJc2xhbmQKU291dGggQ2Fyb2xpbmEKU291dGggRGFrb3RhClRlbm5lc3NlZQpUZXhhcwpVdGFoClZlcm1vbnQKVmlyZ2luaWEKV2FzaGluZ3RvbgpXZXN0IFZpcmdpbmlhCldpc2NvbnNpbgpXeW9taW5n",
            "filename": "states.txt"
        }
    ]

    mkdir("source_data", {recursive: false}, console.error)
    cursor.write("created source directory\n\n")

    for (let source of sources) {
        cursor
            .up()
            .eraseLine()
            .write(`downloading "${source.filename}"...\n`)

        let res = await fetch(source.url)
        if (res.status != 200) throw new Error("could not download data frm source: " + source.url)
        
        const file_stream = createWriteStream("source_data/"+source.filename)
        const { body } = await fetch(source.url)
        await finished(Readable.fromWeb(body).pipe(file_stream)) 
    }
    cursor.reset()
}

async function get_raw_camera_data(){
    let camera_data
    let setLoaded
    let loaded = new Promise(res=>setLoaded=res)
    readFile("source_data/cameras.geojson", "utf-8", (err, data) => {
        camera_data = JSON.parse(data)
        setLoaded()
    })

    await loaded
    return camera_data
}

async function get_camera_data(){
    let camera_data
    let setLoaded
    let loaded = new Promise(res=>setLoaded=res)
    readFile("synth_data/simple_data.json", "utf-8", (err, data) => {
        camera_data = JSON.parse(data)
        setLoaded()
    })

    await loaded
    return camera_data
}

async function get_states(){
    let states = []
    let setLoaded
    let loaded = new Promise(res=>setLoaded=res)
    readFile("source_data/states.txt", "utf-8", (err, data)=>{
        states = data.replaceAll("\r","").split("\n")
        setLoaded()
    })
    
    await loaded
    return states
}

async function get_count(cam_data, location, radius = 5){
    function deg_to_rad(deg){
        return deg/180 * PI 
    }

    const target_lat = location.lat
    const target_lon = -location.lon // longitude must be positive
    const check_radius = radius

    let count = 0

    for (let camera of cam_data){
        let cam_lat = deg_to_rad(camera.location.lat)
        let cam_lon = deg_to_rad(-camera.location.lon)
        
        let dlat = cam_lat - target_lat
        let dlon = cam_lon - target_lon
        
        let a = Math.sin(dlat / 2)**2 + Math.cos(target_lat) * Math.cos(cam_lat) * Math.sin(dlon / 2)**2
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        let dist = RADIUS * c

        if (dist <= check_radius) count++
    }
    // console.log(`there are ${count} cameras in a ${check_radius} mile radius`)
    return count
}

async function get_pop_data(){
    let pop_data
    let setLoaded
    let loaded = new Promise(res=>setLoaded=res)

    readFile("source_data/NST-EST2025-ALLDATA.csv", "utf-8", (err, data)=>{
        let lines = data.split("\n")
        let pop_table = lines.map(e=>e.split(","))
        pop_table.shift()
        pop_data = {}
        for (let i = 0; i < pop_table.length; i++){
            if (pop_table[i].length < 97) continue
            pop_data[pop_table[i][4].toLowerCase().replaceAll(" ", "_")] = {
                name: pop_table[i][4],
                pop: +pop_table[i][11],
                pop_change: +pop_table[i][17],
                births: +pop_table[i][23],
                deaths: +pop_table[i][29],
            }
        }
        setLoaded()
    })
    await loaded
    return pop_data
}

function normalize_state(state_name) {
    return state_name
        .toLowerCase()
        .replaceAll(" ", "_")
}

function ratio_approx(number, settings={}){
    settings = {...{a_step:1, b_step:1, epsilon:0.000_001}, ...settings}
    let a = 0;
    let b = settings.b_step;
    while (Math.abs(number - (a/b)) > settings.epsilon) {
        if (a/b > number) b += settings.b_step
        else a += settings.a_step
    }
    return {a: a, b: b}
}

async function lookup_coord(lat, lon) {

    try {
        let data = lookUpRaw(lat, lon)
        // console.log(lat, lon)

        return {
            countryName: data.features[0].properties.admin
                .replaceAll("United States of America", "United States"),
            adminName: data.features[0].properties.name,
            countryCode: data.features[0].properties.iso_a2
        }
    }
    catch (err){
        // console.error(err)
        return false
    }
}

const dumped_tables = []
async function dump_table(filename, data, headers=undefined){
    let table = headers ? [headers, ...data] : data
    let lines = table.map(row => row.join(","))
    let output = lines.join("\n")
    writeFile("generated_tables/"+filename, output, (err)=>console.error)
    dumped_tables.push(filename)
}

async function combine_tables(filename, table_files){
    let wbk = new ExcelJS.Workbook()
    wbk.creator = "Skye"
    wbk.lastModifiedBy = "Skye"
    wbk.created = new Date()

    wbk.calcProperties.fullCalcOnLoad = true;

    const format_name = function(name){
        name = name.replaceAll("_"," ").replaceAll(/^\W+|\W+$/g, "").split(".")[0]
        name = name[0].toUpperCase() + name.splice(1)
        return name
    }
    for (let table_file of table_files){
        // load sheet data from csv
        const sheet = await wbk.csv.readFile("generated_tables/"+table_file, {sheetName: format_name(table_file)})
        sheet.columns.forEach((column, index) => {
            let max_length = 0;
            
            if (column.header) {
                max_length = column.header.toString().length
            }

            column.eachCell({includeEmpty: true}, (cell, cell_index)=>{
                const cell_len = cell.text ? cell.text.toString().length : 0
                if (cell_len > max_length) max_length = cell_len
            })

            const calc_width = Math.max(max_length +2, 10)
            column.width = calc_width
        })
    }
    wbk.xlsx.writeFile("generated_tables/"+filename)
}

async function simplify_cam_data(raw_camera_data){
    let simple_data = []
    let cam_count = raw_camera_data.features.length
    let index = 0
    let bad_data_count = 0
    let last_time = Date.now()
    const format_time = (ms_delta)=>{
        let time = {
            ms: Math.floor(ms_delta % 1000),
            sec: Math.floor((ms_delta / 1_000) % 60),
            min: Math.floor((ms_delta / 60_000) % 60),
            hours: Math.floor((ms_delta / 3_600_000))
        }
        const pad = (number, padding)=>{
            let len = number.toString().length
            return (len < padding ? "0".repeat(padding-len) : "") + number.toString()
        }
        return `${time.hours}:${pad(time.min, 2)}:${pad(time.sec, 2)}.${pad(time.ms, 3)}`
    }
    cursor.write("bad data: 0\nprocess is 0% complete\n")
    while (index <= cam_count){
        let camera = raw_camera_data.features[index]
        let geodata
        try { geodata = await lookup_coord(camera.geometry.coordinates[1], camera.geometry.coordinates[0])}
        catch {geodata = false}
        if (!geodata || geodata.hasOwnProperty("message")) {
            bad_data_count++
            cursor
                .up().up()
                .fg.red()
                .write(`bad data: ${bad_data_count}`)
                .fg.reset()
                .write('\n')
                .down()

            // console.warn("bad data")
            // console.log(geodata)
            geodata = {
                countryName: "Error",
                adminName: undefined,
                countryCode: undefined,
            }
        }
        try {
            simple_data.push({
                location: {
                    lat: camera.geometry.coordinates[1],
                    lon: camera.geometry.coordinates[0],
                    geodata: geodata
                },
                brand: camera.properties.brand,
                timestamp: camera.properties.osmTimestamp,
            })
        }
        catch {}
        // console.log(simple_data[simple_data.length-1])
        
        index++
        if (index % 1000 == 0) {
            let time = Date.now() - last_time
            let remaining = cam_count-index
            let est_time = remaining/1000 * time
            last_time = Date.now()

            cursor
                .up()
                .eraseLine()
                .write(`process is ${Math.floor(index/cam_count*100)}% complete (eta: ${format_time(est_time)})\n`)
            // console.info(`passing entry ${index} of ${cam_count}`)
        }
    }

    cursor.reset()
    let setFinished
    let finished = new Promise(res=>setFinished=res)
    writeFile("synth_data/simple_data.json", JSON.stringify(simple_data), err=>{
        if (err) throw err
        setFinished()
    })
    await finished
}

await download_sources()
await assure_structure()

if (!existsSync("synth_data/simple_data.json")){
    console.info("creating simplified data\nthis may take a while")
    let cam_data = await get_raw_camera_data()
    await simplify_cam_data(cam_data)
}

console.info("writing tables")

let cam_data = await get_camera_data()

console.log("getting camera counts at different radii")
let count_table = []
const gps_location = await get_location_or_ask()
for (let i = 5, j = 0; i <= 25; i+=5, j++){
    count_table[j] = [i, await get_count(cam_data, gps_location, i)]
}

console.info("writing table")
await dump_table("count_per_mile_radius.csv", count_table, ["Radius", "APLR camera count"])

console.info("getting per capita camera table")

let pop_data = await get_pop_data()
let states = await get_states()

let table_data = []
for (let state of states) {
    let data = cam_data.filter(el => el.location.geodata.adminName && normalize_state(el.location.geodata.adminName) === normalize_state(state))
    let state_data = pop_data[normalize_state(state)]
    if (!state_data) {
        console.warn("No state data for " + normalize_state(state))
        continue
    }
    let ratio = ratio_approx(data.length / state_data.pop, {b_step: 100, epsilon: 0.000_000_1})
    table_data.push([
        state_data.name,
        state_data.pop,
        data.length,
        state_data.pop / data.length,
        `${ratio.a} cameras to ${ratio.b} people`
    ])
}
let data = cam_data.filter(el => el.location.geodata.countryName != "United States" && el.location.geodata.countryName != "Error")
table_data.push(["Outside USA", "X", data.length, "X", "X"])
data = cam_data.filter(el => el.location.geodata.countryName == "Error")
table_data.push(["Search failed", "X", data.length, "X", "X"])

console.info("writing table")
await dump_table("per_capita_cameras.csv", table_data, ["State", "State population", "Camera count", "Person to camera ratio", "per captia ratio"])

console.info("getting date table")
const now = Date.now()
let date = new Date("2024-01-01T05:00:00.000Z")
let date_table = []
while (now.valueOf() > date.valueOf()) {
    let count_at_time = 0 
    for (let cam of cam_data) {
        let cam_date = new Date(cam.timestamp)
        if (date.valueOf() > cam_date.valueOf()) count_at_time++;
    }
    date_table.push([date.toLocaleString().replaceAll(",",""), date.valueOf(), count_at_time])
    date = new Date(date.setMonth(date.getMonth() + 1))
}
console.info("writing date table")

await dump_table("count_at_date.csv", date_table, ["Date", "timestamp", "count"])

console.info("compositing tables")
await combine_tables("analysis.xlsx", dumped_tables)