Add-Type -AssemblyName System.Device
$GeoWatcher = New-Object System.Device.Location.GeoCoordinateWatcher
$GeoWatcher.Start()

while (($GeoWatcher.Status -ne 'Ready') -and ($GeoWatcher.Permission -ne 'Denied')) {
    Start-Sleep -Milliseconds 100
}

if ($GeoWatcher.Permission -eq 'Denied'){
    Write-Error 'Location permission denied'
} else {
    Write-Output "{`"lon`": $($GeoWatcher.Position.Location.Longitude), `"lat`": $($GeoWatcher.Position.Location.Latitude)}"
}