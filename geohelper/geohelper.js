// only supports windows
import { exec } from "node:child_process";
import { read } from "node:fs";
import * as readline from "node:readline/promises";

const SUPPORTED_PLATFORMS = ["win32"]

export async function get_location(){
    switch (process.platform){
        case "win32":
            let setFinished
            let location = new Promise(res=>setFinished=res)
            exec("powershell -File geohelper\\get_location.ps1", (err, stdout, stderr)=>{
                if (err){
                    throw err
                }
                else if (stderr) {
                    throw new Error(`error in script: ${stderr}`)
                }
                else {
                    setFinished(JSON.parse(stdout))
                }
            })
            return await location
            break;

        default:
            throw new Error("Unsupported platform")
    }
}

export async function get_location_or_ask(){
    // console.log(process.env)
    if (!process.env.hasOwnProperty("LOCATION_DEFER")){ // defer to env if setting is unset
        if (process.env.hasOwnProperty("LAT") && process.env.hasOwnProperty("LON")) {
            return {
                lat: +process.env.LAT,
                lon: +process.env.LON
            }
        }
    }
    let rl = readline.createInterface(process.stdin, process.stdout)
    if (SUPPORTED_PLATFORMS.includes(process.platform)) {
        let res = await rl.question("this platform is supported for automatic location discovery, would you like to let the program get your device's location? (Y/n): ")
        if (res.length === 0 || res[0].toLowerCase() === "y") {
            rl.close()
            try {
                return get_location()
            }
            catch (err) {
                console.error(err.message)
                console.info("proceeding to ask user for location")
            }
        }
    }
    let lat = await rl.question("latitude: ")
    let lon = await rl.question("longitude: ")
    rl.close()
    return {
        lat: +lat,
        lon: +lon
    }
}