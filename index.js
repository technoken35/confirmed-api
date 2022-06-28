import NevadaDmvApi from'./NevadaDmvApi.js'
import * as http from 'http';
import {BRANCH_MAP, NV_DMV_BASE_URL, SERVICE_MAP} from "./constants/index.js";
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
            const queryObject = new Url.parse(req.url, true).query;
            let serviceList = [];
            const dmvApi = await new NevadaDmvApi();

            if (queryObject.services){
                let branchesWithServices = await dmvApi.getBranchesWithServices();
                // arbitrarily grab the services from the Decatur branch
                serviceList = branchesWithServices.data.filter((serviceGroups) => serviceGroups.branchPublicId === BRANCH_MAP['Decatur'])

                // branch -> service groups -> services
                // the service groups and services are duplicated throughout each branch
                serviceList = serviceList[0].serviceGroups[0].services;
            }

            if (queryObject.serviceIds){
                let requestedServiceIds = queryObject.serviceIds.split(',');

                // TODO refactor into something more elegant
                serviceList = serviceList.filter((service) => requestedServiceIds.includes(service.publicId));

                console.log('serviceList', serviceList)
            }

            let days = queryObject.days || 4;

            const formattedData = await dmvApi.getBranchesWithServicesAndTimes(serviceList, days)

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(formattedData));
        }catch(e){
            console.warn(e)
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({'message': `An error has occurred: ${e.message}`}));
        }
    }

    if (req.url.includes('/api/nv/dmv/soonest') && req.method === 'GET'){
        const queryObject = new Url.parse(req.url, true).query;

        try{
            if (!queryObject.serviceId){
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({message: 'No service specified'}))

                return;
            }

            if (queryObject.metro){
                queryObject.metro = 'vegas';
            }

            const soonestAppointment = await new NevadaDmvApi().getSoonestAppointment(queryObject.serviceId, queryObject.metro)
            console.log(soonestAppointment, 'soonest appointment returned')

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(soonestAppointment));
        }catch(e){
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({'message': `An error has occurred: ${e.message}`}));
        }
    }

    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Route not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`server started on port: ${PORT}`);
});
