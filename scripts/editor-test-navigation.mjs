// Exercise the same expandable navigation as the author, including closed groups.
export async function openEditorItem(page,selector){
  const item=page.locator(selector),group=item.locator('..');
  if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();
  await item.click();
}
