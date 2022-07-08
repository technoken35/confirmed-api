import NevadaDmvApi from'./NevadaDmvApi.js'
import * as http from 'http';
import {BRANCH_MAP, NV_DMV_BASE_URL, SERVICE_MAP} from "./constants/index.js";
import axios from "axios";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser"
import {getRequestData, sleep} from "./helpers/index.js";
import * as Url from "url";
import {error} from "selenium-webdriver";

const PORT = process.env.PORT || 7000;

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

//set the request route
app.get('/api', function (req,res, next) {
    res.json('Hi there');
});

app.get('/api/nv/dmv/token', async function (req, res, next) {
    const dmvApi = new NevadaDmvApi();
    await dmvApi.init()

    const cookies = await dmvApi.getCookies();

    await dmvApi.cleanup();

    res.json(cookies);
});

app.get('/api/nv/branches', async function (req, res, next) {
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

        let days = Number(queryObject.days) || 2;

        const formattedData = await dmvApi.getBranchesWithServicesAndTimes(serviceList, days)

        res.json(formattedData);
    }catch(e){
        console.warn(e)
       res.json({error: e})
    }
});

app.get('/api/nv/dmv/soonest', async function (req, res, next) {
    const queryObject = req.query;

    try {
        if (!queryObject.serviceId) {
            res.json({error: {'message': 'No service specified'}});
        }

        const soonestAppointment = await new NevadaDmvApi().getSoonestAppointment(queryObject.serviceId, queryObject.metro)
        console.log(soonestAppointment, 'soonest appointment returned')

        res.json(soonestAppointment);
    } catch (e) {
        res.json({error: e});
    }
});

app.post('/api/nv/dmv/book/soonest', async function (req, res, next) {
    console.log('trying to book 1')

    try {
        const nevadaDmvApi = new NevadaDmvApi();
        // const services = await nevadaDmvApi.getServices();
        const appointment = await new NevadaDmvApi().bookSoonestAppointment(req.body.service.publicId, 'vegas', nevadaDmvApi.user)

        if (appointment === null){
            res.status(500)

            res.json({error: {'message': 'Error booking the appointment. Try again.'}})
        }

        res.json(appointment);
    } catch (e) {
        console.log(e);
        res.json({error: e});
    }
})

app.post('/api/nv/dmv/book', async function (req, res, next) {
    console.log('trying to book')

    try {
        console.log(req.body, 'body');

        const nevadaDmvApi = new NevadaDmvApi();
        const services = await nevadaDmvApi.getServices();
        let requestedService = services.filter((service) => service.publicId === req.body.branch.serviceList[0].publicId)[0];
        requestedService.dates = req.body.branch.serviceList[0].dates;

        const appointment = await new NevadaDmvApi().bookAppointment(requestedService, req.body.branch, req.body.user)

        res.json(appointment);
    } catch (e) {
        console.log(e);
        // res.json({error: e});
    }
});

app.listen(8080, async () => {
    console.log(`server started on portyyy: ${PORT}`);
});