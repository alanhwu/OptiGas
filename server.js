//Set as module so that we can easily import fetch
//This makes us do our requires as "import"
import fetch from "node-fetch";
import express from 'express';
import Datastore from "nedb";

//using NeDB, create a new database file called gasfeed.db
const database = new Datastore('gasfeed.db');
//calling expressJS
const app = express();
//useful global variable to keep track of the latest entry in the database
let latest;
//allows us to append to existing entries in gasfeed.db for database persistence
database.loadDatabase();

//run this on port 3000
app.listen(3000, () => console.log('listening at 3000'));

//GET "/gas" implementation
app.get('/gas', (request, response) => {
    database.find({timestamp: latest},(err, data) => {

	//error handling
	if(err){
	    const error = true;
	    const message = "Failed to fetch gas prices from database.";
            response.json({error, message});
            return;
        }

	//strip the JSON object of unneeded info on the user's end
	delete data[0].timestamp;
	delete data[0]._id;

	//return a successful result
	const error = false;
	const message = data[0];
	response.json({error, message});
    });
  });

//GET "/average?fromTime=&toTime=" implementation
app.get('/average', (request, response) => {

    //write in console the bounds of the interval
    console.log(request.query);
    //parse these to be held in as integers (must be for the MongoDB queries to work properly)
    const fromTime = parseInt(request.query.fromTime);
    const toTime = parseInt(request.query.toTime);

    //MongoDB-style query. Find entries of timestamp >= fromTime and <= toTime
    database.find( {timestamp: { $gte: fromTime, $lte: toTime}},(err, data) => {

	//error handling
	if(err){
	    const error = true;
	    const message = "Unable to calculate average. Ensure interval exists in database";
	    response.json({error,message});
	    return;
	}

	if(fromTime > latest || toTime > latest){
	    const error = true;
	    const message = "One or more arguments refers to a time in the future. Ensure interval exists in database";
	    response.json({error,message});
	    return;
	}

	
	//At this point, json object "data" holds all entries between fromTime and toTime
	//if our query finds nothing, we don't have the data. Return an error
	if(data.length ==0){
	    const error = true;
	    const message = "Unable to calculate average. Ensure interval exists in database";
	    response.json({error,message});
	    return;
	}

	//Calculation of average
	let sum = 0;
	//traverse "data" and sum up the average gas prices from each
	for (let i=0; i<data.length; i++) {
	    sum+=parseInt(data[i].average);
//	    console.log(sum);
	}
	const count = data.length;
	//divide sum by total to get average
	//rounding the gas to the nearest whole num
	const averageGasPrice = ~~(sum/data.length);

	//return a successful result
	const error = false;
	const message = {averageGasPrice, fromTime, toTime};
	response.json({error, message});
    });
});


//Implementation of a repeating call to Etherscan's API
function repeat(){

//using Fetch and my API key to their gas oracle
fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=AMIWTXU\
PV8Z5N19PZERCVR1CMRMRGDRDFC)')
    .then(res => res.json())
	.then(json => {

	//Parse the resulting JSON into local variables
	const fast = json.result.FastGasPrice;
	const average = json.result.ProposeGasPrice;
	const low = json.result.SafeGasPrice;
	const blockNum = json.result.LastBlock;

	//we must divide our timestamp by 1000 because JS gives it in milliseconds
	const timestamp = ~~(Date.now()/1000);
	const data = {fast, average, low, blockNum, timestamp};

	//update our pointer to latest entry in database
	latest = timestamp;

	//display the data we just received and insert it into our database
	console.log(data);
	database.insert(data);
    })

    //repeat this every 5 seconds (the rate-limit on Etherscan)
    setTimeout(repeat,5000);
}

repeat();
