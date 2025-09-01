const axios = require('axios');

const payload = {
  operationName: 'searchJobCardsByLocation',
  query: `query searchJobCardsByLocation($searchJobRequest: SearchJobRequest!) {
    searchJobCardsByLocation(searchJobRequest: $searchJobRequest) {
      nextToken
      jobCards {
        jobId
        jobTitle
        employmentType
        city
        locationName
        totalPayRateMin
        totalPayRateMax
      }
    }
  }`,
  variables: {
    searchJobRequest: {
      locale: 'en-CA',
      country: 'Canada',
      keyWords: '',
      equalFilters: [],
      containFilters: [
        { key: 'isPrivateSchedule', val: ['false'] }
      ],
      pageSize: 10
    }
  }
};

const headers = {
  'content-type': 'application/json',
  'authorization': process.env.AMAZON_API_TOKEN || 'Bearer Status|unauthenticated|Session|eyJhbGciOiJLTVMiLCJ0eXAiOiJKV1QifQ.eyJpYXQiOjE3NTY3MTM5MjAsImV4cCI6MTc1NjcxNzUyMH0.AQICAHidzPmCkg52ERUUfDIMwcDZBDzd+C71CJf6w0t6dq2uqwEODCaeVmQhcMsmUGi60a5GAAAAtDCBsQYJKoZIhvcNAQcGoIGjMIGgAgEAMIGaBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDCwGqBup49tPWjjXegIBEIBtFh3/B62vS74RGoTfb3pk+LiIhxqKzMAsnoc5o6Iq62n7ktkOEXi+W0YJ9cC+WYsNLHiU4KAuP7p3wQQr5jFr4XdP+qo2ueffAlj/OD3f4pWxDFZci8EvMAD4NR/H/8dLDG8lOygv/8E6O8vqWA==',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'origin': 'https://hiring.amazon.ca',
  'referer': 'https://hiring.amazon.ca/'
};

console.log('🔍 Testing with minimal filters...');
axios.post('https://e5mquma77feepi2bdn4d6h3mpu.appsync-api.us-east-1.amazonaws.com/graphql', payload, { headers })
.then(res => {
  const jobs = res.data?.data?.searchJobCardsByLocation?.jobCards || [];
  console.log(`✅ Found ${jobs.length} jobs with minimal filters:`);
  jobs.slice(0, 5).forEach((job, i) => {
    console.log(`  ${i + 1}. ${job.jobTitle} - ${job.locationName} (${job.city}) | ${job.employmentType} | $${job.totalPayRateMin}-${job.totalPayRateMax}`);
  });
}).catch(err => {
  console.error('❌ Error:', err.response?.status, err.response?.data?.errors?.[0]?.message);
});
