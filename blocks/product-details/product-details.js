/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
import { events } from '@dropins/tools/event-bus.js';
import { initializers } from '@dropins/tools/initializer.js';
import * as productApi from '@dropins/storefront-pdp/api.js';
import { render as productRenderer } from '@dropins/storefront-pdp/render.js';
import ProductDetails from '@dropins/storefront-pdp/containers/ProductDetails.js';

// Libs
import { getProduct, getSkuFromUrl, setJsonLd } from '../../scripts/commerce.js';
import { getConfigValue } from '../../scripts/configs.js';
import { fetchPlaceholders, readBlockConfig } from '../../scripts/aem.js';
import { createAccordion, generateListHTML } from '../../scripts/scripts.js';
import initToast from './toast.js';

// Add to cart
async function addToCart({
  sku, quantity, optionsUIDs, product,
}) {
  const { cartApi } = await import('../../../scripts/minicart/api.js');

  return cartApi.addToCart(sku, optionsUIDs, quantity, product);
}

// Error Handling (404)
async function errorGettingProduct(code = 404) {
  const htmlText = await fetch(`/${code}.html`).then((response) => {
    if (response.ok) {
      return response.text();
    }
    throw new Error(`Error getting ${code} page`);
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  document.head.innerHTML = doc.head.innerHTML;
}

async function setJsonLdProduct(product) {
  const {
    name, inStock, description, sku, urlKey, price, priceRange, images, attributes,
  } = product;
  const amount = priceRange?.minimum?.final?.amount || price?.final?.amount;
  const brand = attributes.find((attr) => attr.name === 'brand');

  setJsonLd({
    '@context': 'http://schema.org',
    '@type': 'Product',
    name,
    description,
    image: images[0]?.url,
    offers: [{
      '@type': 'http://schema.org/Offer',
      price: amount?.value,
      priceCurrency: amount?.currency,
      availability: inStock ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
    }],
    productID: sku,
    brand: {
      '@type': 'Brand',
      name: brand?.value,
    },
    url: new URL(`/products/${urlKey}/${sku.toLowerCase()}`, window.location),
    sku,
    '@id': new URL(`/products/${urlKey}/${sku.toLowerCase()}`, window.location),
  }, 'product');
}

function createMetaTag(property, content, type) {
  if (!property || !type) {
    return;
  }
  let meta = document.head.querySelector(`meta[${type}="${property}"]`);
  if (meta) {
    if (!content) {
      meta.remove();
      return;
    }
    meta.setAttribute(type, property);
    meta.setAttribute('content', content);
    return;
  }
  if (!content) {
    return;
  }
  meta = document.createElement('meta');
  meta.setAttribute(type, property);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

function setMetaTags(product) {
  if (!product) {
    return;
  }

  const price = product.priceRange
    ? product.priceRange.minimum.final.amount : product.price.final.amount;

  createMetaTag('title', product.metaTitle, 'name');
  createMetaTag('description', product.metaDescription, 'name');
  createMetaTag('keywords', product.metaKeyword, 'name');

  createMetaTag('og:type', 'og:product', 'property');
  createMetaTag('og:description', product.shortDescription, 'property');
  createMetaTag('og:title', product.metaTitle, 'property');
  createMetaTag('og:url', window.location.href, 'property');
  const mainImage = product?.images?.filter((image) => image.roles.includes('thumbnail'))[0];
  const metaImage = mainImage?.url || product?.images[0]?.url;
  createMetaTag('og:image', metaImage, 'property');
  createMetaTag('og:image:secure_url', metaImage, 'property');
  createMetaTag('og:product:price:amount', price.value, 'property');
  createMetaTag('og:product:price:currency', price.currency, 'property');

  createMetaTag('twitter:card', product.shortDescription, 'name');
  createMetaTag('twitter:title', product.metaTitle, 'name');
  createMetaTag('twitter:image', metaImage, 'name');
}

export default async function decorate(block) {
  const blockConfig = readBlockConfig(block);
  block.innerHTML = '';

  const skuFromUrl = getSkuFromUrl();
  if (!window.getProductPromise) {
    window.getProductPromise = getProduct(skuFromUrl);
  }

  let product;
  const [tempProduct, placeholders] = await Promise.all([
    window.getProductPromise, fetchPlaceholders()]);
  product = tempProduct;

  let productSku;
  if (product) {
    // product available
    productSku = getSkuFromUrl();
  } else {
    // no product found, no sku
    product = await getProduct(blockConfig['default-product']);
    productSku = blockConfig['default-product'];
    // await errorGettingProduct();
    // return Promise.reject();
  }

  const langDefinitions = {
    default: {
      PDP: {
        Product: {
          Incrementer: { label: placeholders.pdpProductIncrementer },
          OutOfStock: { label: placeholders.pdpProductOutofstock },
          AddToCart: { label: placeholders.pdpProductAddtocart },
          Details: { label: placeholders.pdpProductDetails },
          RegularPrice: { label: placeholders.pdpProductRegularprice },
          SpecialPrice: { label: placeholders.pdpProductSpecialprice },
          PriceRange: {
            From: { label: placeholders.pdpProductPricerangeFrom },
            To: { label: placeholders.pdpProductPricerangeTo },
          },
          Image: { label: placeholders.pdpProductImage },
        },
        Swatches: {
          Required: { label: placeholders.pdpSwatchesRequired },
        },
        Carousel: {
          label: placeholders.pdpCarousel,
          Next: { label: placeholders.pdpCarouselNext },
          Previous: { label: placeholders.pdpCarouselPrevious },
          Slide: { label: placeholders.pdpCarouselSlide },
          Controls: {
            label: placeholders.pdpCarouselControls,
            Button: { label: placeholders.pdpCarouselControlsButton },
          },
        },
        Overlay: {
          Close: { label: placeholders.pdpOverlayClose },
        },
      },
      Custom: {
        AddingToCart: { label: placeholders.pdpCustomAddingtocart },
        AddToWishlist: { label: placeholders.pdpCustomAddtowishlist },
        Share: { label: placeholders.pdpCustomShare },
      },
    },
  };

  const models = {
    ProductDetails: {
      initialData: { ...product },
      transform: (data) => {
        data.images.forEach((image) => {
          // Extract the image file name from the URL
          const imageUrlParts = image.url.split('/');
          const imageFileName = imageUrlParts[imageUrlParts.length - 1];
          const modifiedImageFileName = imageFileName.replace(/_/g, '-');

          // Update the URL to the new format
          image.url = `/images/products/${modifiedImageFileName}`;
        });
        return {
          ...data,
        };
      },
    },
  };

  // Initialize Dropins
  initializers.register(productApi.initialize, {
    langDefinitions,
    models,
  });

  // Set Fetch Endpoint (Service)
  productApi.setEndpoint(await getConfigValue('commerce-endpoint'));

  // Set Fetch Headers (Service)
  productApi.setFetchGraphQlHeaders({
    'Content-Type': 'application/json',
    'Magento-Environment-Id': await getConfigValue('commerce-environment-id'),
    'Magento-Website-Code': await getConfigValue('commerce-website-code'),
    'Magento-Store-View-Code': await getConfigValue('commerce-store-view-code'),
    'Magento-Store-Code': await getConfigValue('commerce-store-code'),
    'Magento-Customer-Group': await getConfigValue('commerce-customer-group'),
    'x-api-key': await getConfigValue('commerce-x-api-key'),
  });

  events.on('eds/lcp', () => {
    if (!product) {
      return;
    }

    setJsonLdProduct(product);
    setMetaTags(product);
    document.title = product.name;
  }, { eager: true });

  // Render Containers
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        await productRenderer.render(ProductDetails, {
          sku: productSku,
          carousel: {
            controls: blockConfig['carousel-layout'] === 'column' ? 'thumbnailsColumn' : 'row',
            arrowsOnMainImage: true,
            mobile: true,
            peak: {
              mobile: true,
              desktop: false,
            },
            gap: 'small',
          },
          slots: {
            Quantity: (ctx) => {
              const label = document.createElement('div');
              label.className = 'quantity-label';
              label.textContent = 'Quantity';
              ctx.prependChild(label);
            },
            Actions: (ctx) => {
              // Add to Cart Button
              ctx.appendButton((next, state) => {
                const adding = state.get('adding');
                return {
                  text: adding
                    ? next.dictionary.Custom.AddingToCart?.label
                    : blockConfig['add-to-cart-btn-text'] || placeholders.pdpProductAddtocart,
                  icon: 'Cart',
                  variant: 'primary',
                  disabled: adding || !next.data.inStock || !next.valid,
                  onClick: async () => {
                    try {
                      state.set('adding', true);
                      if (!next.valid) {
                        // eslint-disable-next-line no-console
                        console.warn('Invalid product', next.values);
                        return;
                      }
                      // const addToCartResponse = await addProductsToCart([{ ...next.values }]);
                      const addToCartResponse = await addToCart({
                        sku: next.values?.sku,
                        quantity: next.values?.quantity,
                        optionsUIDs: next.values?.optionsUIDs,
                        product: next.data,
                      });

                      console.log("addToCartResponse: ", addToCartResponse);

                      // toast notification
                      if (next.valid && addToCartResponse) {
                        const { quantity } = next.values;
                        const productMetaDescription = next.data.metaDescription;
                        initToast(quantity, productMetaDescription);
                      }
                    } catch (error) {
                      // eslint-disable-next-line no-console
                      console.warn('Error adding product to cart', error);
                    } finally {
                      state.set('adding', false);
                    }
                  },
                };
              });
              // Add To Wishlist Button
              ctx.appendButton(() => ({
                text: blockConfig['add-to-wishlist-btn-text'] ? blockConfig['add-to-wishlist-btn-text'] : placeholders.pdpCustomAddtowishlist,
                icon: 'Heart',
                variant: 'secondary',
                onClick: () => console.debug('Add to Wishlist', ctx.data),
              }));

              // Share Button
              ctx.appendButton(() => ({
                text: blockConfig['share-btn-text'] ? blockConfig['share-btn-text'] : placeholders.pdpCustomShare,
                icon: 'Share',
                variant: 'secondary',
                onClick: () => console.debug('Share Button', ctx.data),
              }));
            },
            Description: (ctx) => {
              const defaultContent = ctx?.data?.description;
              if (!defaultContent) return;

              const [html, updateContent] = createAccordion('Overview', defaultContent, true);
              ctx.replaceWith(html);

              ctx.onChange((next) => {
                updateContent(next?.data?.description);
              });
            },
            ShortDescription: (ctx) => {
              const shortDescContent = ctx?.data?.shortDescription;
              if (!shortDescContent) return;

              const [html, updateContent] = createAccordion('Short description', shortDescContent, false);
              ctx.replaceWith(html);

              ctx.onChange((next) => {
                updateContent(next?.data?.shortDescription);
              });
            },
            Attributes: (ctx) => {
              const attributes = ctx?.data?.attributes;
              if (!attributes) return;

              let list;
              list = generateListHTML(attributes);
              const [html, updateContent] = createAccordion('Product specs', list, false);
              ctx.replaceWith(html);

              ctx.onChange((next) => {
                list = generateListHTML(next?.data?.attributes);
                updateContent(list);
              });
            },
          },
          useACDL: true,
        })(block);
      } catch (e) {
        console.error(e);
        await errorGettingProduct();
      } finally {
        resolve();
      }
    }, 0);
  });
}
