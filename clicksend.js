const query = new URLSearchParams({
  page: '1',
  limit: '15',
  q: 'field_name',
  order_by: 'date:asc',
  date_from: '0',
  date_to: '0'
}).toString();

const resp = await fetch(
  `https://rest.clicksend.com/v3/sms/history?page=1&limit=15&q=field_name&order_by=date%3Aasc&date_from=0&date_to=0?${query}`,
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa('ubonheur2021@gmail.com:28F7CEAD-F267-B48C-C3AE-003ECE0E595B')
    }
  }
);

const data = await resp.text();
console.log(data);
