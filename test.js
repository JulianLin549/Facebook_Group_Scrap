let url = 'https://www.google.com/maps/d/u/0/viewer?mid=1I8nWhKMX1j8I2bUkN4qN3-FSyFCCsCh7&ll=25.02629050000002%2C121.47718700000001&z=20'
let location = url.match(/\=\d*\.\d*\%2C\d*\.\d*/)
location = location[0].match(/\d*\.\d*/g)
location = [parseFloat(location[1]), parseFloat(location[0])]
console.log(location)