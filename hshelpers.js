require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const DESTINATION_ACCESS_TOKEN = process.env.DESTINATION_ACCESS_TOKEN;
const BASE_URI = process.env.BASE_URI;
const pipeline = "default";
const path = require("path");
const striptags = require("striptags");
const FormData = require("form-data");  
async function readDataFromJson(filePath, limit = 5) {
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
        sf_lead_owner: data?.OwnerId,
        sf_lead_status: data?.Status,
        firstname: data?.Name ? data.Name.split(' ')[0] : '',
        lastname: data?.Name?.split(' ').slice(1).join(' '),
        email: data?.Email,
        phone: data?.Phone,
        hs_whatsapp_phone_number: data?.MobilePhone,
        sf_title: data?.Title,
        sf_account: data?.Account__r?.Name,
        company: data?.Company,
        website: data?.Website,
        industry: data?.Industry,
        hs_linkedin_url: data?.LinkedIn_URL__c,
        sf_employee_size: data?.NumberOfEmployees,
        hs_country_region_code: data?.Region__c,
        country: data?.Country,
        sf_sub_lead_source: data?.Sub_Lead_Source__c,
        sf_campaign: data?.Campaign__c,
        sf_budget: data?.Budget__c,
        sf_use_case: data?.Use_Case__c,
        sf_product: data?.Product__c,
        sf_chat_link: data?.Chat_Link__c,
        sf_demo_by: data?.Demo_By__c,
        sf_demo_date: data?.Demo_Date__c,
        sf_qualified_by: data?.Qualified_By__c,
        sf_demo_requested_date_client: data?.Demo_Requested_Date_Client__c,
        sf_created_by: data?.CreatedBy?.Id,
        sf_createdby_name: data?.CreatedBy?.Name,
        sf_createdby_email: data?.CreatedBy?.Email,
        sf_lastmodifiedby_id: data?.LastModifiedBy?.Id,
        sf_lastmodifiedby_name: data?.LastModifiedBy?.Name,
        sf_lastmodifiedby_email: data?.LastModifiedBy?.Email,
        sf_lead_id: data?.Id,
        sf_owner_name: data?.Owner?.Name,
        sf_owner_id: data?.Owner?.Id,
        sf_owner_email: data?.Owner?.Email,
        sf_employee_size: data?.NumberOfEmployees,
        sf_funding:data?.Funding__c,
        sf_type_of_business:data?.typeofbusiness__c,
        sf_lead_source:data?.LeadSource,
        sf_last_activity_since:data?.Last_activity_since__c,
        sf_created_date_timestamp__c:data?.Created_Date_Timestamp__c,
        sf_lead_status:data.Status,
        sf_personal_email:data.PersonalEmail



      }
    };
    console.log("contactData", contactData);
    const contactRecordId = await updateOrCreateData('contact', existingContactId, contactData);
    if (contactRecordId) {
      console.log("contactRecordId", contactRecordId);
      console.log("data.Account__c", data.Account__c);
      // await ContactAssociation(contactRecordId, data.Account__c);
      // await processEmailThreads(contactRecordId, 'contacts', 'test-leads');
      await processCalls(contactRecordId, 'contacts', 'test-recordings');
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

    
      const data = {
        properties: {
          name: company.Name,
          sf_account_owner: company.Owner?.Name,
          sf_type: company.Type,
          website: company.Website,
          phone: company.Phone,
          sf_industry: company.Industry,
          hs_employee_range: company.Employee_Size__c,
          description: company.Description,
          sf_account_id: company.Id,
          sf_owner_id: company.OwnerId,
          sf_owner_name: company.Owner?.Name,
          sf_owner_email: company.Owner?.Email,
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
      await processEmailThreads(companyId, 'companies', 'AccountEmailsAndAttachmentsNewFormat')
      await processCalls(companyId, 'companies', 'recordings')
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
        sf_opportunity_owner: data.Owner?.Name,
        sf_account_name: data.Account?.Name,
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
        sf_product: data.Product__c,
        sf_sub_lead_source:data.O__c,
        sf_referral_partner:data.Referral_Partner__c,
        sf_primary_campaign_source:data.Campaign?.Name,
        sf_owner_id:data.Owner?.Id,
        sf_owner_email: data.Owner?.Email,
        sf_owner_name: data.Owner?.Name,
        dealname: data.Name,
        pipeline: pipelineId // Use correct pipeline ID
      }
    };

    // console.log("dealData", dealData);

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

    const newDealId=await updateOrCreateData('deals', existingDealId, dealData);
    await processEmailThreads(newDealId, 'deals', 'OpportunityEmailsAndAttachmentsNewFormat')
    await processCalls(newDealId, 'deals', 'recordings')
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

const processEmailThreads = async (objectId, objectType, folder) => {
  // const dir = path.join(__dirname, 'Account+Opp Email With Attach New Format', folder)
  const dir = path.join(__dirname, 'Email+Attachments (Account+Lead+Opportunity)', folder)
  const data = await getEmailsAndAttachments(dir)
  let response, folderId

  if (objectType === 'companies') {
    response = await readObjectById(objectId, objectType, 'sf_account_id')
    folderId = response.properties.sf_account_id
  }

  if (objectType === 'deals') {
    response = await readObjectById(objectId, objectType, 'sf_opportunity_id')
    folderId = response.properties.sf_opportunity_id
  }

  if (objectType === 'contacts') {
    response = await readObjectById(objectId, objectType, 'sf_lead_id')
    folderId = response.properties.sf_lead_id
  }

  for (const emails of data.slice(0, 10)) {
    const { email, attachments, outerFolderId } = emails
    if (outerFolderId === folderId) {
      const emailFields = extractEmailFields(email)

      let emailCCs = [], emailBCCs = [], emailTo = []

      emailTo = emailFields.to.split(';').map(email => ({ email: email.trim() }))
      if (emailFields.cc !== 'null') {
        emailCCs = emailFields.cc.split(';').map(email => ({ email: email.trim() }))
      }
      if (emailFields.bcc !== 'null') {
        emailBCCs = emailFields.bcc.split(';').map(email => ({ email: email.trim() }))
      }

      const attachmentIds = []
      const emailData = {
        properties: {
          hs_timestamp: new Date().toISOString(),
          hs_email_text: emailFields.body,
          hs_email_direction: 'EMAIL',
          hs_email_headers: JSON.stringify({
            from: { "email": `${emailFields.from}` },
            sender: { "email": `${emailFields.from}` },
            to: emailTo,
            cc: emailCCs,
            bcc: emailBCCs
          })
        }
      }

      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const form = new FormData()
          form.append('file', fs.createReadStream(attachment))
          form.append('folderId', 222699260131)
          form.append('options', JSON.stringify({ "access": "PRIVATE" }))
          const attachmentId = await uploadFiles(form)
          attachmentIds.push(attachmentId)
        }
      }
      emailData.properties.hs_attachment_ids = attachmentIds.join(';')

      const emailId = await createEmail(emailData)
      await associateEmailWithObject(objectType, objectId, emailId)
    }
  }
}
const getEmailsAndAttachments = async (dir, outerFolderId = null) => {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      const currentFolderId = outerFolderId || item.name
      // Recursively read subfolders
      const subfolderResults = await getEmailsAndAttachments(itemPath, currentFolderId);
      results.push(...subfolderResults)
    } else if (item.isFile() && item.name.endsWith('.txt')) {
      // Read .txt file content
      const emailText = fs.readFileSync(itemPath, 'utf-8');

      // Get attachments in the same folder
      const folderFiles = fs.readdirSync(dir)
        .filter(file => file !== item.name && !file.endsWith('.txt'))  // Exclude current txt and other txt files
        .map(file => path.join(dir, file))

      results.push({
        outerFolderId: outerFolderId,
        email: cleanEmail(emailText),
        attachments: folderFiles,
      })
    }
  }

  return results
}
const readObjectById = async (id, objectType, propertyName) => {
  const { data } = await axios.get(`${BASE_URI}/crm/v3/objects/${objectType}/${id}`, {
    params: {
      properties: propertyName,
    },
    headers: {
      Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  })
  return data
}
const uploadFiles = async (form) => {
  // console.log(form, ...form.getHeaders())
  try {
    const { data } = await axios.post(`${BASE_URI}/files/v3/files`, form, {
      headers: {
        Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
        ...form.getHeaders(),
      }
    })
    return data.id
  } catch (error) {
    throw Error(`Error uploading files: ${error.message}.`)
  }
}

const cleanEmail = (emailText) => {
  let cleanedEmail = striptags(emailText);

  // Decode HTML entities
  cleanedEmail = cleanedEmail
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  // Remove unwanted links, social sections, and special characters
  cleanedEmail = cleanedEmail
    .replace(/_{5,}\s*Follow us on\s*(\[https:\/\/[^\]]+\]\s*)*/gi, '\n')  // Replace "_________ Follow Us on" with newline
    .replace(/\[https:\/\/[^\]]+\]/g, '')  // Remove Googleusercontent links
    .replace(/^\s*>>/gm, '')  // Remove ">>" from beginning of lines
    .replace(/^\s*--/gm, '')  // Remove "--" (signature separators)

  // Add line breaks before HubSpot headers
  cleanedEmail = cleanedEmail
    .replace(/(From:|To:|Cc:|Bcc:|Sent:)/g, '\n$1')  // Add line breaks before headers
    .replace(/On\s(.+?)\swrote:/g, '\n\nOn $1 wrote:\n')  // Line break before quoted messages
    .replace(/(\w+:)\s/g, '\n$1 ')  // Line break before name/email tags
    .replace(/\s{2,}/g, '\n')  // Remove excessive whitespace
    .replace(/^\s*[-*>]+/gm, '')  // Remove unwanted leading characters (-, *, >)
    .replace(/^\s{2,}/gm, '')  // Remove excessive leading spaces
    .replace(/(__+)/g, '\n$1\n')  // Format separator lines
    .replace(/(Thanks,|Regards,|--)/g, '\n$1')  // Add line break before signatures
    .trim();

  // Apply HubSpot-friendly HTML formatting
  const formatForHubSpot = (email) => {
    return email
      .replace(/(\n)/g, '<br>')  // Use <br> for line breaks in HubSpot
      .replace(/(\s{2,})/g, '&nbsp;');  // Use &nbsp; for extra spaces
  }

  const formattedEmail = formatForHubSpot(cleanedEmail);
  return formattedEmail;
};

const extractEmailFields = (email) => {
  const fields = {
    from: (email.match(/From:\s*([^\n<>]+)/i) || [])[1]?.trim() || "",
    to: (email.match(/To:\s*([^\n<>]+)/i) || [])[1]?.trim() || "",
    cc: (email.match(/Cc:\s*([^\n<>]+)/i) || [])[1]?.trim() || "",
    bcc: (email.match(/Bcc:\s*([^\n<>]+)/i) || [])[1]?.trim() || "",
    body: email
  };

  // const bccMatchIndex = email.indexOf('BCC:');

  // if (bccMatchIndex !== -1) {
  //   // Extract the body starting from the next line after BCC
  //   fields.body = email.substring(bccMatchIndex).trim();
  // } else {
  //   // If no BCC, assign the entire email as body
  //   fields.body = email.trim();
  // }

  return fields;
}

const associateEmailWithObject = async (objectType, objectId, emailId) => {

  if (!objectId || !emailId) {
    console.error("Error: Missing ids for association.");
    return
  }

  let objectTypeId
  switch (objectType) {
    case 'companies':
      objectTypeId = 185
      break;
    case 'deals':
      objectTypeId = 209
      break
    case 'contacts':
      objectTypeId = 197
      break
    default:
      throw Error('Invalid objectType')
  }
  const associationPayload = [
    {
      associationCategory: "HUBSPOT_DEFINED",
      associationTypeId: objectTypeId,
      objectId: emailId,
    },
  ];

  try {
    const response = await axios.put(
      `${BASE_URI}/crm/v4/objects/${objectType}/${objectId}/associations/emails/${emailId}`,
      associationPayload,
      {
        headers: {
          Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    // console.log("response", response.data);
    // console.log("Association with email created successfully:", response.data);
  } catch (error) {
    console.error("Error creating association with email:", error.response.data);
    console.error("Error details:", error.response.status, error.response.statusText);
    // You can also log the associationPayload object to verify its contents
    console.log("Association payload:", associationPayload);
  }
}

const createEmail = async (email) => {
  try {
    const { data } = await axios.post(`${BASE_URI}/crm/v3/objects/emails`, email, {
      headers: {
        Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return data.id
  } catch (error) {
    throw Error(`Error creating email: ${error}.`)
  }
}

const associateCallWithObject = async (objectType, objectId, callId) => {

  if (!objectId || !callId) {
    console.error("Error: Missing ids for association.");
    return
  }

  let objectTypeId
  switch (objectType) {
    case 'companies':
      objectTypeId = 181
      break;
    case 'deals':
      objectTypeId = 205
      break
    case 'contacts':
      objectTypeId = 193
      break
    default:
      throw Error('Invalid objectType')
  }
  const associationPayload = [
    {
      associationCategory: "HUBSPOT_DEFINED",
      associationTypeId: objectTypeId,
      objectId: callId,
    },
  ];

  try {
    const response = await axios.put(
      `${BASE_URI}/crm/v4/objects/${objectType}/${objectId}/associations/calls/${callId}`,
      associationPayload,
      {
        headers: {
          Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    // console.log("response", response.data);
    // console.log("Association with email created successfully:", response.data);
  } catch (error) {
    console.error("Error creating association with calls:", error.response.data);
    console.error("Error details:", error.response.status, error.response.statusText);
    // You can also log the associationPayload object to verify its contents
    console.log("Association payload:", associationPayload);
  }
}

const createCall = async (call) => {
  try {
    const { data } = await axios.post(`${BASE_URI}/crm/v3/objects/call`, call, {
      headers: {
        Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return data.id
  } catch (error) {
    throw Error(`Error creating call: ${error.message}.`)
  }
}

const processCalls = async (objectId, objectType, folder) => {
  const dir = path.join(__dirname, folder)
  const data = await getEmailsAndAttachments(dir)
  let response, folderId

  if (objectType === 'companies') {
    response = await readObjectById(objectId, objectType, 'sf_account_id')
    folderId = response.properties.sf_account_id
  }

  if (objectType === 'deals') {
    response = await readObjectById(objectId, objectType, 'sf_opportunity_id')
    folderId = response.properties.sf_opportunity_id
  }

  if (objectType === 'contacts') {
    response = await readObjectById(objectId, objectType, 'sf_lead_id')
    folderId = response.properties.sf_lead_id
  }

  for (const call of data) {
    const { email, attachments, outerFolderId } = call
    if (outerFolderId === folderId) {
      const attachmentIds = []
      const callData = {
        properties: {
          hs_timestamp: new Date().toISOString(),
          hs_call_body: email,
        }
      }

      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const form = new FormData()
          form.append('file', fs.createReadStream(attachment))
          form.append('folderId', 222699260131)
          form.append('options', JSON.stringify({ "access": "PRIVATE" }))
          const attachmentId = await uploadFiles(form)
          attachmentIds.push(attachmentId)
        }
      }
      callData.properties.hs_attachment_ids = attachmentIds.join(';')
      const callId = await createCall(callData)
      await associateCallWithObject(objectType, objectId, callId)
    }
  }
}
module.exports = {
  readDataFromJson,
  syncContactData,
  syncCompanyData,
  syncDealData,
  createNoteInHubSpot
};