import aboutHtml from "../../site/about.html?raw";
import appoinmentHtml from "../../site/appoinment.html?raw";
import contactHtml from "../../site/contact.html?raw";
import indexHtml from "../../site/index.html?raw";
import serviceHtml from "../../site/service.html?raw";

export const PAGE_SOURCE: Record<string, string> = {
  index: indexHtml,
  about: aboutHtml,
  service: serviceHtml,
  appoinment: appoinmentHtml,
  contact: contactHtml,
};
