require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const DESTINATION_ACCESS_TOKEN = process.env.DESTINATION_ACCESS_TOKEN;
const BASE_URI = process.env.BASE_URI;



// async function readDataFromJson(filePath, limit = 2) {
//   try {
//     const datas = fs.readFileSync(filePath, 'utf8');
//     const limitedData = datas.slice(0, 2);
//     console.log("Limited data:", limitedData);
//     return datas.slice(0, limit);
//   } catch (error) {
//     console.error("Error reading contacts file:", error.message);
//     return [];  // Return an empty array in case of error
//   }
// }




async function readDataFromJson(filePath, limit = 9) {
    try {
      const rawData = fs.readFileSync(filePath, "utf8"); // Read the file as a string
      const jsonData = JSON.parse(rawData); // Convert string to JSON
  
      if (!Array.isArray(jsonData)) {
        throw new Error("Invalid JSON format: Expected an array");
      }
  
      const limitedData = jsonData.slice(0, limit); // Extract only `limit` items
      console.log("Limited data:", limitedData);
      return limitedData;
    } catch (error) {
      console.error("Error reading contacts file:", error.message);
      return []; // Return an empty array in case of error
    }
  }
const syncContactData = async (datas) => {
    const processedContacts = [];
    for (const data of datas) {
        console.log("data----------------->", data);  
      const existingContactId = await searchContactInHubSpot(data.Email);

      // console.log('sleep start')
      // await new Promise(resolve => setTimeout(resolve, 3000));
      // console.log('sleep end')
      // console.log('existingContactId', existingContactId)
      const contactRecordId = await updateOrCreateContactData('contact', existingContactId, data, 'Member');
      // if (contactRecordId) {
      //   await ContactAssociation(contactRecordId, data.practicenumber);
      // }
  
    }
  
  };

  async function updateOrCreateContactData(objectType, existingContactId, datas) {
    const contactData = {
      properties: {
        accreditation_notes:datas.accreditationnotes ?? null,
      },
    };
  
    try {
      if (existingContactId) {
        await axios.patch(
          `${BASE_URI}/crm/v3/objects/${objectType}/${existingContactId}`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );
        return existingContactId;
      } else {
        console.log("No existing contact ID found for the update.");
      }
    } catch (error) {
      console.error(`Error updating/creating contact (${datas.email || 'unknown'}):`, error.response?.data || error.message);
      fs.appendFile('practices_with_updateContactDataMembersAccreditations.log', `${datas.riasnumber}\n`, function (err) {
        if (err) {
          console.error(err);
        }
      });
      return null;
    }
  }
  const searchContactInHubSpot = async (email) => {
    const filters = {
      filterGroups: [
        {
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        },
      ],
    };
    return searchDataOnHubspot('contact', filters);
  };
  async function searchDataOnHubspot(objectType, filters) {
    try {
      const response = await axios.post(
        `${BASE_URI}/crm/v3/objects/${objectType}/search`,
        filters,
        {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.results.length > 0 ? response.data.results[0].id : null;
    } catch (error) {
      console.error(`Error searching ${objectType}:`, error.message);
      return null;
    }
  }

  const ContactAssociation = async (contactRecordId, practicenumber) => {
    const companyId = await searchCompanyInHubSpot(practicenumber);
    if (companyId) {
      await associateCompanyWithContact(contactRecordId, companyId);
    } else {
      console.log(`No company found with practicenumber: ${practicenumber}`);
    }
  }
module.exports = {
    readDataFromJson,
    syncContactData
  };