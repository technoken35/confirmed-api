import {Browser, Builder, By, until} from 'selenium-webdriver';
import {BRANCH_MAP, NV_DMV_BASE_URL, SERVICE_MAP} from "./constants/index.js";
import {sleep} from "./helpers/index.js";
import axios from "axios";

export default class NevadaDmvApi {

    async init() {
        this.driver = await new Builder().forBrowser(Browser.CHROME).build();
        await this.driver.get(`${NV_DMV_BASE_URL}/`);

        const cookies = await this.getCookies();

        console.log('COOKEs', cookies);
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
       return await this.driver.manage().getCookies();
   }

   async getBranchesWithServices(){
        const data = await axios.get(`${NV_DMV_BASE_URL}/rest/schedule/appointmentProfiles/`);

        return data;
   }

   async getServiceTimes(branchId, date, serviceId){
        const times = axios.get(`${NV_DMV_BASE_URL}/rest/schedule/branches/${branchId}/dates/${date}/times;servicePublicId=${serviceId};customSlotLength=30`)
   }

   async getBranchesWithServicesAndTimes(serviceList, days){
        let formattedData = [];
       // for each branch group make an api call for the times for the respective service
       let branchList = await axios.get(`${NV_DMV_BASE_URL}/rest/schedule/branches/available`);
       branchList = branchList.data

       for(let branchIndex = 0; branchIndex < branchList.length; branchIndex++){
           branchList[branchIndex].serviceList = [];

           for(let serviceIndex = 0; serviceIndex < serviceList.length; serviceIndex++){
               const dateEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/branches/${branchList[branchIndex].id}/dates;servicePublicId=${serviceList[serviceIndex].publicId}`

               const datePromise = await axios.get(dateEndpoint)

               serviceList[serviceIndex].dates = datePromise.data.slice(0, days);

               console.log(serviceList[serviceIndex].dates.length, branchList[branchIndex].name)

               let dateTimes = [];
               for (let timeIndex = 0; timeIndex < serviceList[serviceIndex].dates.length; timeIndex++){
                   const timeEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/branches/${branchList[branchIndex].id}/dates/${serviceList[serviceIndex].dates[timeIndex].date}/times;servicePublicId=${serviceList[serviceIndex].publicId};customSlotLength=30`

                   const timePromise = await axios.get(timeEndpoint)

                   dateTimes = [...dateTimes, ...timePromise.data]
               }

               serviceList[serviceIndex].dates = dateTimes;

               branchList[branchIndex].serviceList = [...branchList[branchIndex].serviceList, serviceList[serviceIndex]];

               formattedData = [...formattedData, branchList[branchIndex]]
           }
       }

       return formattedData;
    }

    async getSoonestAppointment(service, metro){
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

            if (!soonestAppointmentDate || soonestAppointmentDateForBranch > soonestAppointmentDate) {
                soonestAppointment = {branch: branches[branchIndex]};
                soonestAppointmentDate = soonestAppointmentForBranch
            }

            console.log(soonestAppointment, 'soonestAppointment');
             // we only need the first one

            branches[branchIndex].serviceList[0].dates = branches[branchIndex].serviceList[0].dates.splice(0, 1);
        }

       return soonestAppointment;
    }


    // fillAppointmentDetails

    // bookSoonestAppointment

    // bookPreferredAppointment

    // timeSlotsAvailableForLocation
}