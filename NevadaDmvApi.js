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

   async getSoonestAppointment(month = null){
       let dt = new Date();

       if (!month){
           month = dt.getMonth();
       }

       let year = dt.getFullYear();
       const daysInMonth = new Date(year, month, 0).getDate();

       let today = new Date().getDate();

       console.log(daysInMonth)

       let counter = 0;
       let dateFound = null;
       let timeSlots = [];
       loop1:
       while (counter !== 3 || !dateFound){
           console.log('month count', counter);
           for(let i = today; i < daysInMonth; i++){
               timeSlots = await this.clickDay(i);

               console.log('attempting to click another day', counter);

               if(timeSlots.length > 0){
                   try{
                       await timeSlots[0].click();
                   }catch (e){
                       console.warn(e)

                       timeSlots = null;

                       continue;
                   }

                   // const timeSlotTakenErrors = await this.findByClassName('v-alert error');
                   let nextStep = null;
                   try{
                       nextStep = await this.driver.wait(until.elementLocated(By.xpath(`//*[text()='${'Clear booking'}']`)));
                   }catch (e){
                       console.warn(e);

                       // if we did not continue to the next step that means something is still wrong, lets keep going
                       continue;
                   }

                   if (nextStep){
                       dateFound = i;

                       console.log('date found', dateFound)

                       break loop1;
                   }
               }

               await sleep(1000);
           }

           if (month === 12){
               month = 0;
           }

           month++;
           counter++;
           today = 1;

           await this.getNextMonth();

           //wait for the next month sliding animation to finish
           await sleep(2000);
       }


       if (dateFound){
           timeSlots[0].click();
       }
       // console.log(dateSelected, 'date found');
       //
       // await dateSelected.click();

       return dateFound;
   }

   async getNextMonth(){
        try{
            await this.clickElementByText('chevron_right');

            return true;
        }catch (e) {
            console.error(e);

            return false;
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

               for (let timeIndex = 0; timeIndex < serviceList[serviceIndex].dates.length; timeIndex++){
                   const timeEndpoint = `${NV_DMV_BASE_URL}/rest/schedule/branches/${branchList[branchIndex].id}/dates/${serviceList[serviceIndex].dates[timeIndex].date}/times;servicePublicId=${serviceList[serviceIndex].publicId};customSlotLength=30`

                   const timePromise = await axios.get(timeEndpoint)

                   serviceList[serviceIndex].dates = timePromise.data
               }

               branchList[branchIndex].serviceList = [...branchList[branchIndex].serviceList, serviceList[serviceIndex]];

               formattedData = [...formattedData, branchList[branchIndex]]
           }
       }

       return formattedData;
    }

    // fillAppointmentDetails

    // bookSoonestAppointment

    // bookPreferredAppointment

    // timeSlotsAvailableForLocation
}