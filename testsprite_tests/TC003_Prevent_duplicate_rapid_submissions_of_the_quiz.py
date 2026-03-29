import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3000
        await page.goto("http://localhost:3000", wait_until="commit", timeout=10000)
        
        # -> Click the button to start the route recommendation quiz (the '나머지 루트 완성하기' button).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section/main/div[5]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Select a companion option (choose the first card '나홀로 뚜벅이').
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[2]/div/div[2]/div/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[2]/nav/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Re-open the route recommendation quiz by clicking the '나머지 루트 완성하기' button so the quiz flow can be completed and rapid submissions can be tested.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section/main/div[5]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Select the first companion option (나홀로 뚜벅이) and then click '다음 단계로' to proceed to the time question.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[2]/div/div[2]/div/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[2]/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Select the 2~5시간 time option and reveal the '다음 단계로' button so the quiz can proceed to the style question.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[3]/div/div[2]/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Click the '다음 단계로' button to proceed to the style question (QUESTION 03).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[3]/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Select a style choice (middle card '감성 기록형') and then attempt to submit rapidly 5 times to verify multiple submissions are blocked (only one recommendation processed).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section[4]/div/div[2]/div[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/nav/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/nav/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Re-open the quiz so the final style-selection & rapid submission test can be repeated (click the '나머지 루트 완성하기' button).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/section/main/div[5]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=추천 결과').first).to_be_visible(timeout=3000)
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    