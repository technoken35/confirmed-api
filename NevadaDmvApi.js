import {Browser, Builder, By, until} from 'selenium-webdriver';
import {BRANCH_MAP, NV_DMV_BASE_URL, NV_DMV_COOKIE_NAME, SERVICE_MAP} from "./constants/index.js";
import {sleep} from "./helpers/index.js";
import axios from "axios";

export default class NevadaDmvApi {
    user = {
        firstName: 'Bill',
        lastName: 'Johnson',
        email: 'confirmedapp333@gmail.com',
        phone: 6082123334,
        searches: [{'serviceId': 2, 'branchId': 4, date:{date: '2022-08-20', time: '10:45'}, status: ''}],
        currentAppointment: {
            branch:{
                publicId: 3,
                serviceList: [
                    {
                        id: 44,
                        dates:[
                            {
                                'date': '2022-08-24',
                                'time': '22:33',
                            }
                        ]
                    }
                ]
            }
        }
    }

    async init() {
        this.driver = await new Builder().forBrowser(Browser.CHROME).build();
        await this.driver.get(`${NV_DMV_BASE_URL}/`);
    }

    async cleanup() {
        await this.driver.quit()
    }

    async getElementByText(string){
        return this.driver.wait(until.elementLocated(By.xpath(`//*[text()='${string}']`)), 20000, 'Timed out after 20 seconds.', 4000)
    }

    async clickElementByText(string){
        try {
            // const element = this.driver.findElement(By.xpath(`//*[text()='${string}']`));
            const element = await this.getElementByText(string)
            await this.driver.executeScript('arguments[0].click()', element);

            return true;
        }catch(e){
            console.error(e)

            return false;
        }
    }

    async clickBranch(branchName){
        console.log('click branch bruh')
        try{
            await this.driver.manage().window().maximize();
            // const branch = await this.driver.findElement(By.xpath(`//input[@aria-labelledby='${BRANCH_MAP[branchName]}']`));
            const branch = await this.driver.wait(until.elementLocated(By.xpath(`//input[@aria-labelledby='${BRANCH_MAP[branchName]}']`)), 20000, 'Timed out after 20 seconds', 4000);

            this.driver.executeScript('arguments[0].click()', branch);

            // await branch.click();
            let selected = await branch.isSelected()

            return true;
        }catch (e) {
            console.error(e)

            return false;
        }
    }

    async clickService(serviceName){
        try{
            // const branch = await this.driver.wait(until.elementLocated(By.xpath(`//input[@value='${SERVICE_MAP[serviceName]}']`)));
            console.log(SERVICE_MAP[serviceName], 'service map')
            const branch = await this.driver.wait(until.elementLocated(By.xpath(`//input[@value='${SERVICE_MAP[serviceName]}']`)), 20000, 'Timed out after 20 seconds.', 4000);
            this.driver.executeScript('arguments[0].click()', branch);

            let selected = await branch.isSelected()

            return true;
        }catch (e) {
            console.error(e)

            return false;
        }
    }

    async clickDay(day){
        try{
            let dayElement = await this.driver.findElement(By.xpath(`//*[text()='${day}']`), 20000, 'Timed out after 20 seconds', 4000);

            // let's try waiting
            if (!dayElement){
                dayElement = this.driver.wait(until.elementLocated(By.xpath(`//*[text()='${day}']`)));
            }

            const dayButton = await this.driver.executeScript('return arguments[0].parentNode.parentNode', dayElement);

            await dayButton.click();

            return await this.driver.findElements(By.className('timeslot'));
        }catch (e){
            console.warn(e);

            return [];
        }
    }

   async findByClassName(className){
        try{
            return await this.driver.findElements(By.className(className))
        }catch (e) {
            return []
        }
   }

   async getCookies(){
        await this.init();
       const cookies = await this.driver.manage().getCookies();

       await this.cleanup();

       console.log(cookies)

       return cookies;
   }

   async getBranchesWithServices(){
        const data = await axios.get(`${NV_DMV_BASE_URL}/rest/schedule/appointmentProfiles/`);

        return data;
   }

   async getServiceTimes(branchId, date, serviceId){
        const times = axios.get(`${NV_DMV_BASE_URL}/rest/schedule/branches/${branchId}/dates/${date}/times;servicePublicId=${serviceId};customSlotLength=30`)
   }

   async getBranchesWithServicesAndTimes(serviceList, days){
       // for each branch group make an api call for the times for the respective service
       let branchList = await axios.get(`${NV_DMV_BASE_URL}/rest/schedule/branches/available`);
       branchList = branchList.data
       let formattedBranchList = [];

       //branches and times are getting out of sync, hence the bad request. Seems like we're using the soonest appointment for carson city but returning the decatur branch
       // think it had something to do with just copying the reference of an object vs cloning an object
       for(let branchIndex = 0; branchIndex < branchList.length; branchIndex++){
           let formattedBranchObject = {...branchList[branchIndex]};
           let formattedServiceList = [];

           for(let serviceIndex = 0; serviceIndex < serviceList.length; serviceIndex++){
               let formattedServiceObject = {...serviceList[serviceIndex]};
               let dateTimes = [];
               const dateEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/branches/${formattedBranchObject.id}/dates;servicePublicId=${formattedServiceObject.publicId}`
               const datePromise = await axios.get(dateEndpoint)

               let serviceDates = datePromise.data.slice(0, days);

               for (let timeIndex = 0; timeIndex < serviceDates.length; timeIndex++){
                   const timeEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/branches/${formattedBranchObject.id}/dates/${serviceDates[timeIndex].date}/times;servicePublicId=${formattedServiceObject.publicId};customSlotLength=30`
                   console.log(timeEndpoint);

                   const timePromise = await axios.get(timeEndpoint)

                   dateTimes = [...dateTimes, ...timePromise.data]
               }

               formattedServiceObject.dates = dateTimes
               formattedServiceList.push(formattedServiceObject);
           }

           formattedBranchObject.serviceList = formattedServiceList;

           formattedBranchList.push(formattedBranchObject);
       }

       return formattedBranchList;
    }

    async getSoonestAppointment(service, metro = 'vegas'){
        let branches = await this.getBranchesWithServicesAndTimes([{publicId: service}], 2);

        // todo refactor this BS lol
        if (metro === 'vegas'){
           branches = branches.filter(branch => !(branch.name.includes('Reno') || branch.name.includes('Carson')));
        }

        if(metro === 'reno'){
           branches = branches.filter(branch => (branch.name.includes('Reno') || branch.name.includes('Carson')));
        }

        let soonestAppointment = null;
        let soonestAppointmentDate = null;

        for(let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
            // appointment is already sorted
            let soonestAppointmentForBranch = branches[branchIndex].serviceList[0].dates[0];
            let [hour, minute] = soonestAppointmentForBranch.time.split(':');
            let soonestAppointmentDateForBranch = new Date(soonestAppointmentForBranch.date).setHours(hour, minute);

            if (!soonestAppointmentDate || soonestAppointmentDateForBranch < soonestAppointmentDate) {
                soonestAppointment = {branch: branches[branchIndex]};
                soonestAppointmentDate = soonestAppointmentDateForBranch
            }

            branches[branchIndex].serviceList[0].dates = branches[branchIndex].serviceList[0].dates.splice(0,1)
        }

       return soonestAppointment;
    }

    async bookSoonestAppointment(service, metro, user = this.user){
       let soonestAppointment = await this.getSoonestAppointment(service, metro);
       let services = await this.getServices();

       // refactor this not getting the full service object back from get soonest appointment for some reason
       let fullServiceObject = services.filter((fullService) => fullService.publicId === service)[0];

       fullServiceObject = {...fullServiceObject, ...soonestAppointment.branch.serviceList[0]}

       let appointment = await this.bookAppointment(fullServiceObject, soonestAppointment.branch, this.user);

       return appointment;
    }

    async bookAppointment(service, branch, user){
        // check if we can book this appointment
        let checkMultipleEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/appointments/checkMultiple;phone=${user.phone};email=${user.email};servicePublicId=${service.publicId};date=${service.dates[0].date};time=${service.dates[0].time}`;

        const checkMultipleResponse = await axios.get(checkMultipleEndpoint);

        console.log(checkMultipleResponse, 'checkMultiple');

        // user cannot book multiple of this type, get out
        if(checkMultipleResponse.data.message.includes('ERROR')){
           return null;
        }

        // there is a mapping between the service and the slot length, need use the correct slot length in order to reserve
        // make an attempt to reserve the slot before we create the appointment
        const reservationEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/branches/${branch.publicId || branch.id}/dates/${service.dates[0].date}/times/${service.dates[0].time}/reserve;customSlotLength=30`;

        console.log(reservationEndpoint, 'reservationEndpoint');
        let peopleServices = [{
            publicId: service.publicId,
            qpId: service.qpId,
            adult: 1,
            name: service.name,
            child: 0
        }];

        // crazy data structure
        const reservationPayload = {
            services: [
              {
                  publicId: service.publicId
              }
            ],
            // custom: {peopleServices},
            custom: JSON.stringify({peopleServices}),
        };

        // return reservationPayload;

        // get the cookie using the selenium webdriver because we need javascript to be enabled in order to get a valid cookie

        const token = await this.getAuthToken();
        const headers = {Cookie: `${NV_DMV_COOKIE_NAME}=${token}`, Accept: '*/*', Connection: 'keep-alive', 'Content-Type': 'application/json'};

        const reserveAppointmentRequest = await axios.post(reservationEndpoint, reservationPayload, {headers});

        // we could not reserve the appointment get out
        if (reserveAppointmentRequest.status > 400 || reserveAppointmentRequest.data.hasOwnProperty('errorMessage')){
            console.log(reserveAppointmentRequest.data, 'failed to reserve appointment')
            return null;
        }

        console.log(reserveAppointmentRequest.data, 'reservation appointment request data');

        // save the reservation id to confirm the appointment
        const reservationId = reserveAppointmentRequest.data.publicId;

        peopleServices.totalCost = 0;
        peopleServices.createdByUser = 'Qmatic Web Booking';
        peopleServices.customSlotLength = 30;

        const confirmationPayload = {
            customer: {
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: '',
                email: user.email,
                phone: `${user.phone}`,
                dob: '',
                externalId: '',
            },
            languageCode: 'en',
            notificationType: '',
            captcha: '',
            custom: JSON.stringify({peopleServices}),
            notes: '',
            title: 'Qmatic Web Booking'
        }

        // finally, lets book the appointment (:
        const confirmationEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/appointments/${reservationId}/confirm`;

        console.log(confirmationEndpoint, confirmationPayload, 'before confirmation')

        // return confirmationPayload;

        const confirmationRequest = await axios.post(confirmationEndpoint, confirmationPayload, {headers})

        console.log(confirmationRequest, 'confirmationRequest')

        return confirmationRequest.data;
    }

    async getAuthToken() {
        const cookies = await this.getCookies();

        return cookies.filter((cookie) => cookie.name === NV_DMV_COOKIE_NAME)[0].value;
    }

    async getServices(){
        const servicesUrl = `${NV_DMV_BASE_URL}/rest/schedule/branches/${BRANCH_MAP['Decatur']}/services`
        const services = await axios.get(servicesUrl);

        return services.data;
    }

    // async getPrefferredAppointment(service, times){
    //
    //     const data = {
    //         service: {publicId: 'foo'},
    //         dates: [
    //             {
    //                 date: '333-222-11',
    //                 times: ['10:45', '12:15', '12:30']
    //             }
    //         ]
    //     }
    //
    //   // attempt to get the service with the specified date
    //   // get the specified times
    //
    //   // for each time check if the time is within the specified
    //
    //   // attempt find times for the specified service and branch
    // }
    //

    // fillAppointmentDetails

    // bookSoonestAppointment

    // bookPreferredAppointment

    // timeSlotsAvailableForLocation
}