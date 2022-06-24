
// loop through branches

// store dates and times in memory

// get user preferences date/time

// click through form to book now that we have the best date

// clean up and die
import NevadaDmvApi from'./NevadaDmvApi.js'
import * as http from 'http';
import {NV_DMV_BASE_URL} from "./constants/index.js";
import axios from "axios";
import {sleep} from "./helpers/index.js";
import * as Url from "url";
const PORT = process.env.PORT || 7000;

const server = http.createServer(async (req, res) => {
    //set the request route
    if (req.url === '/api' && req.method === 'GET') {
        //response headers
        res.writeHead(200, { 'Content-Type': 'application/json' });
        //set the response
        res.write('Hi there, This is a Vanilla Node.js API');
        //end the response
        res.end();
    }

    if(req.url === '/api/nv/dmv/token' && req.method === 'GET'){
        const dmvApi = new NevadaDmvApi();
        await dmvApi.init()
        
        const cookies = await dmvApi.getCookies();

        res.writeHead(200, { 'Content-Type': 'application/json' });

        res.end(JSON.stringify(cookies));

        await dmvApi.cleanup();
    }

    if (req.url === '/api/nv/dmv/branches' && req.method === 'GET'){
        try{
            const queryObject = new Url.parse(req.url, true).query;
            console.log(queryObject, 'queryObject');
            const response = await axios.get(`${NV_DMV_BASE_URL}/rest/schedule/branches/available`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(queryObject));
        }catch(e){
            console.warn(e)
        }
    }

    if (req.url.includes('/api/nv/dmv/branches') && req.method === 'GET'){
        try{
            const response = await axios.get(`${NV_DMV_BASE_URL}/rest/schedule/branches/available`);
            const queryObject = new Url.parse(req.url, true).query;

            let services = [];
            if (queryObject.services){
                foreach(queryObject.)
            }

            console.log(queryObject, 'queryObject');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response.data));
        }catch(e){
            console.warn(e)
        }
    }

    // get all branches with services and timeslots

    // getSoonestTimeSlot

    // getPreferredTimeSlot

    // If no route present
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Route not found' }));
    }

    // // step 1
    // const branchSelected = await dmvApi.clickBranch('Flamingo');
    // // step 2
    // const serviceSelected = await dmvApi.clickService('Drivers License  - New');
    // // step 3
    // await dmvApi.clickElementByText('Select date and time')
    //
    // await dmvApi.getSoonestAppointment();
});

server.listen(PORT, () => {
    console.log(`server started on port: ${PORT}`);
});
