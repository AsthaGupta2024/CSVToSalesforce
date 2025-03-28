require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const DESTINATION_ACCESS_TOKEN = process.env.DESTINATION_ACCESS_TOKEN;
const BASE_URI = process.env.BASE_URI;
const pipeline = "default";
async function readDataFromJson(filePath, limit = 4) {
  try {
    const rawData = fs.readFileSync(filePath, "utf8"); // Read the file as a string
    const jsonData = JSON.parse(rawData); // Convert string to JSON

    if (!Array.isArray(jsonData)) {
      throw new Error("Invalid JSON format: Expected an array");
    }

    const limitedData = jsonData.slice(0, limit); // Extract only `limit` items
    return limitedData;
  } catch (error) {
    console.error("Error reading contacts file:", error.message);
    return []; // Return an empty array in case of error
  }
}
const syncContactData = async (datas) => {
  const processedContacts = [];
  for (const data of datas) {
    const existingContactId = await searchContactInHubSpot(data.Email);
    const contactData = {
      properties: {
        sf_lead_owner: data.OwnerId,
        sf_lead_status: data.Status,
        firstname: data?.Name ? data.Name.split(' ')[0] : '',
        lastname: data.Name.split(' ').slice(1).join(' '),
        email: data.Email,
        phone: data.Phone,
        hs_whatsapp_phone_number: data.MobilePhone,
        sf_title: data.Title,
        sf_account: data.Account__c,
        company: data.Company,
        website: data.Website,
        industry: data.Industry,
        hs_linkedin_url: data.Linkedin_URL__c,
        sf_employee_size: data.Employee_Size__c,
        hs_country_region_code: data.Region__c,
        country: data.Country,
        sf_sub_lead_source: data.Sub_Lead_Source__c,
        sf_campaign: data.Campaign__c,
        sf_budget: data.Budget__c,
        sf_use_case: data.Use_Case__c,
        sf_product: data.Product__c,
        sf_chat_link: data.Chat_Link__c,
        sf_demo_by: data.Demo_By__c,
        sf_demo_date: data.Demo_Date__c,
        sf_qualified_by: data.Qualified_By__c,
        sf_demo_requested_date_client: data.Demo_Requested_Date_Client__c,
        sf_created_by: data.CreatedBy.Id,
        sf_createdby_name: data.CreatedBy.Name,
        sf_createdby_email: data.CreatedBy.Email,
        sf_last_modified_by: data.LastModifiedBy.Id,
        sf_lastmodifiedby_name: data.LastModifiedBy.Name,
        sf_lastmodifiedby_email: data.LastModifiedBy.Email,
        sf_lead_id: data.Id,
        sf_owner_name: data.Owner.Name,
        sf_owner_id: data.Owner.Id,
        sf_owner_email: data.Owner.Email
      }
    };
    const contactRecordId = await updateOrCreateData('contact', existingContactId, contactData);
    if (contactRecordId) {
      console.log("contactRecordId", contactRecordId);
      console.log("data.Account__c", data.Account__c);
      await ContactAssociation(contactRecordId, data.Account__c);
    }

  }

};
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
    console.log("responseofei", response.data.results);
    return response.data.results.length > 0 ? response.data.results[0].id : null;
  } catch (error) {
    console.error(`Error searching ${objectType}:`, error.message);
    return null;
  }
}
const associateContactWithCompany = async (contactId, companyId) => {
  if (!contactId || !companyId) {
    console.error("Error: Missing contactId or companyId for association.");
    return;
  }

  const associationPayload = [
    {
      associationCategory: "HUBSPOT_DEFINED",
      associationTypeId: 279,
      objectId: companyId,
    },
  ];

  try {
    const response = await axios.put(
      `${BASE_URI}/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`,
      associationPayload,
      {
        headers: {
          Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("response", response.data);
    console.log("Association created successfully:", response.data);

  } catch (error) {
    console.error("Error creating association:", error.response.data);
    console.error("Error details:", error.response.status, error.response.statusText);
    // You can also log the associationPayload object to verify its contents
    console.log("Association payload:", associationPayload);
  }
}
const ContactAssociation = async (contactRecordId, Accountc) => {
  const companyId = await searchCompanyInHubSpot(Accountc);
  console.log("companyId", companyId);
  if (companyId) {
    await associateContactWithCompany(contactRecordId, companyId);
  } else {
    console.log(`No company found with companyId: ${contactRecordId}`);
  }
}
const AccountAssociationOpportunity = async (companyRecordId, opportunityId) => {
  const Opportunity= await searchDealInHubSpot(opportunityId);
  console.log("Opportunity", Opportunity);
  if (Opportunity) {
    await associateOpportunityWithAccount(companyRecordId, Opportunity);
  } else {
    console.log(`No opportunity found with companyRecordId: ${companyRecordId}`);
  }
}

const associateOpportunityWithAccount = async (companyRecordId, Opportunity) => {
  if (!companyRecordId || !Opportunity) {
    console.error("Error: Missing companyRecordId or opportunityId for association.");
    return;
  }

  const associationPayload = [
    {
      associationCategory: "HUBSPOT_DEFINED",
      associationTypeId: 342,
      objectId: Opportunity,
    },
  ];

  try {
    const response = await axios.put(
      `${BASE_URI}/crm/v4/objects/companies/${companyRecordId}/associations/deals/${Opportunity}`,
      associationPayload,
      {
        headers: {
          Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("response", response.data);
    console.log("Association created successfully:", response.data);

  } catch (error) {
    console.error("Error creating association:", error.response.data);
    console.error("Error details:", error.response.status, error.response.statusText);
    // You can also log the associationPayload object to verify its contents
    console.log("Association payload:", associationPayload);
  }
}

const searchCompanyInHubSpot = async (Account__c) => {
  const filters = {
    filterGroups: [
      {
        filters: [{ propertyName: "sf_account_id", operator: "EQ", value: Account__c }],
      },
    ],
  };
  return await searchDataOnHubspot('company', filters);
};
const syncCompanyData = async (companies) => {
  for (const company of companies) {
    console.log("Processing company:", company);
    const companyId = company.Id;
    console.log("companyId:", companyId);
    const filter = {
      filterGroups: [
        {
          filters: [{ propertyName: "sf_account_id", operator: "EQ", value: companyId }],
        },
      ],
    };

    const existingCompanyId = await searchDataOnHubspot("companies", filter);
    console.log("existingCompanyId:", existingCompanyId);

    if (existingCompanyId) {
      console.log(`Company already exists with ID: ${existingCompanyId}`);
    } else {
      const data = {
        properties: {
          name: company.Name,
          sf_account_owner: company.OwnerId,
          sf_type: company.Type,
          website: company.Website,
          phone: company.Phone,
          sf_industry: company.Industry,
          hs_employee_range: company.Employee_Size__c,
          description: company.Description,
          sf_account_id: company.Id,
          sf_owner_name: company.Owner?.Name || null,
          sf_owner_id: company.Owner?.Id || null,
          sf_owner_email: company.Owner?.Email || null,
        },
      };

      const companyRecordId = await updateOrCreateData("companies", existingCompanyId, data);
      console.log("New company created with ID:", companyRecordId);

      if (company.Opportunities?.records?.length > 0) {
        const opportunityId = company.Opportunities.records[0]?.Id;
        if (opportunityId) {
          console.log("Company Record ID:", companyRecordId);
          console.log("Opportunity ID:", opportunityId);
          await AccountAssociationOpportunity(companyRecordId, opportunityId);
        } else {
          console.log("Opportunity record found, but 'Id' is missing.");
        }
      } else {
        console.log("No opportunities found for this company.");
      }
    }
  }
};

async function updateOrCreateData(objectType, existingContactId, datas) {
  try {
    console.log("update data")
    if (existingContactId) {
      await axios.patch(
        `${BASE_URI}/crm/v3/objects/${objectType}/${existingContactId}`,
        datas,
        {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return existingContactId;
    } else {
      console.log("create accountttt")
      const createResponse = await axios.post(
        `${BASE_URI}/crm/v3/objects/${objectType}`,
        datas,
        {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log("createResponse", createResponse.data.email)
      return createResponse.data.id;
    }
  } catch (error) {
    console.error(`Error updating/creating contact (${datas.Email || 'unknown'}):`, error.response?.data || error.message);
    fs.appendFile('practicesaccount.log', `${datas.Email}\n`, function (err) {
      if (err) {
        console.error(err);
      }
    });
    return null;
  }
}

const syncDealData = async (datas) => {
  const processedContacts = [];

  for (const data of datas) {
    console.log("enterrr");

    // Search for an existing deal
    const existingDealId = await searchDealInHubSpot(data.Id);
    console.log('existingDealId', existingDealId);

    // Ensure correct pipeline ID (Replace 'YOUR_PIPELINE_ID' with actual ID)
    const pipelineId = "default"; // Replace with your actual pipeline ID

    // Correct variable name to avoid redeclaration conflict
    const dealData = {
      properties: {
        sf_opportunity_owner: data.OwnerId,
        sf_account_name: data.AccountId,
        sf_contact: data.Contact__c,
        sf_type: data.Type,
        sf_region: data.Region__c,
        sf_probability: data.Probability,
        sf_amount: data.Amount,
        sf_implementation_fee: data.Implementation_Fee__c,
        sf_billing_cycle: data.Billing_Cycle__c,
        sf_contract_sign_date: data.Contract_Sign_Date__c,
        closed_lost_reason: data.Loss_Reason__c,
        sf_lead_source: data.LeadSource,
        sf_qualified_by: data.Qualified_By__c,
        sf_cs_manager: data.CS_Manager__c,
        sf_industry: data.Industry__c,
        sf_opportunity_id: data.Id,
        dealname: data.Name,
        pipeline: pipelineId // Use correct pipeline ID
      }
    };

    console.log("datas.StageName", data.StageName);

    // Map Salesforce stages to HubSpot stages (Replace with correct stage names)
    const stageMapping = {
      'Appointment Scheduled': 'appointmentscheduled',
      'Qualified To Buy': 'qualifiedtobuy',
      'Presentation Scheduled': 'presentationscheduled',
      'Decision Maker Bought-In': 'decisionmakerboughtin',
      'Contract Sent': 'contractsent',
      'Closed Won': 'closedwon',
      'Closed Lost': 'closedlost'
    };

    // Set the correct deal stage
    dealData.properties.dealstage = stageMapping[data.StageName] || "decisionmakerboughtin";

    // Ensure the stage exists in the pipeline before sending data
    if (!Object.values(stageMapping).includes(dealData.properties.dealstage)) {
      console.error(`Invalid deal stage: ${dealData.properties.dealstage}`);
      continue;
    }

    await updateOrCreateData('deals', existingDealId, dealData);
  }

  return processedContacts;
};
const searchDealInHubSpot = async (dealId) => {
  if (!dealId) {
    console.log("Deal ID is required.");
    return null;
  }
  console.log('2')
  const filters = {
    filterGroups: [
      {
        filters: [{ propertyName: "sf_opportunity_id", operator: "EQ", value: dealId }],
      },
    ],
  };
  return await searchDataOnHubspot('deal', filters);
};
async function createNoteInHubSpot(objectId, noteContent, objectType) {
  console.log("ObjectId:", objectId);
  console.log("noteContent:", noteContent);
  console.log("ObjectType:", objectType);

  try {
    const timestamp = new Date().getTime();
    const associations = {
      [objectType]: [objectId], // Dynamically assign object type
    };

    const response = await axios.post(
      "https://api.hubapi.com/engagements/v1/engagements",
      {
        engagement: {
          active: true,
          type: "NOTE",
          timestamp, // Send timestamp in milliseconds
        },
        associations,
        metadata: {
          body: noteContent.replace(/<p>/g, "").replace(/<\/p>/g, "\n"), // Remove <p> tags and replace with newline
        },
      },
      {
        headers: {
          Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`Note for ${objectType} ${objectId} synced successfully:`, response.data);
  } catch (error) {
    console.error(`Error adding note to ${objectType} ${objectId}:`, error.message);
  }
}

module.exports = {
  readDataFromJson,
  syncContactData,
  syncCompanyData,
  syncDealData,
  createNoteInHubSpot
};