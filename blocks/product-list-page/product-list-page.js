import { loadScript, readBlockConfig } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';

export default async function decorate(block) {
  const { urlpath, category, type } = readBlockConfig(block);
  block.textContent = '';

  const widgetProd = '/scripts/widgets/search.js';
  await loadScript(widgetProd);

  const storeDetails = {
    environmentId: await getConfigValue('commerce-environment-id'),
    environmentType: (await getConfigValue('commerce-endpoint')).includes('sandbox') ? 'testing' : '',
    apiKey: await getConfigValue('commerce-x-api-key'),
    websiteCode: await getConfigValue('commerce-website-code'),
    storeCode: await getConfigValue('commerce-store-code'),
    storeViewCode: await getConfigValue('commerce-store-view-code'),
    config: {
      pageSize: 8,
      perPageConfig: {
        pageSizeOptions: '12,24,36',
        defaultPageSizeOption: '24',
      },
      minQueryLength: '2',
      currencySymbol: '$',
      currencyRate: '1',
      displayOutOfStock: true,
      allowAllProducts: false,
      imageCarousel: false,
      optimizeImages: true,
      imageBaseWidth: 200,
      listview: true,
      displayMode: '', // "" for plp || "PAGE" for category/catalog
      addToCart: async (...args) => {
        const { cartApi } = await import('../../scripts/minicart/api.js');
        return cartApi.addToCart(...args);
      },
    },
    context: {
      customerGroup: await getConfigValue('commerce-customer-group'),
    },
    route: ({ sku }) => `/products/${sku}`,
  };

  if (type !== 'search') {
    const categoryName = urlpath[0].toUpperCase() + urlpath.slice(1);

    storeDetails.config.categoryName = categoryName;
    storeDetails.config.currentCategoryUrlPath = urlpath;

    // Enable enrichment
    block.dataset.category = category;
  }

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (window.LiveSearchPLP) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });

  window.LiveSearchPLP({ storeDetails, root: block });

  // Add custom title
  const resultsHeaderTitle = block.querySelector('.ds-widgets_results > div:first-of-type > div > div:first-of-type');
  const formattedUrlPath = urlpath.replace('-', ' ');
  resultsHeaderTitle.classList.add('results-header-title');
  resultsHeaderTitle.textContent = `Shop ${formattedUrlPath}`;
}
