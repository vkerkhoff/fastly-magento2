<?php
/**
 * Fastly CDN for Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Fastly CDN for Magento End User License Agreement
 * that is bundled with this package in the file LICENSE_FASTLY_CDN.txt.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Fastly CDN to newer
 * versions in the future. If you wish to customize this module for your
 * needs please refer to http://www.magento.com for more information.
 *
 * @category    Fastly
 * @package     Fastly_Cdn
 * @copyright   Copyright (c) 2016 Fastly, Inc. (http://www.fastly.com)
 * @license     BSD, see LICENSE_FASTLY_CDN.txt
 */
namespace Fastly\Cdn\Controller\Adminhtml\FastlyCdn\Vcl;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\Request\Http;
use Magento\Framework\Controller\Result\JsonFactory;
use Fastly\Cdn\Model\Config;
use Fastly\Cdn\Model\Api;
use Fastly\Cdn\Helper\Vcl;
use Magento\Framework\Exception\LocalizedException;

/**
 * Class Blocking
 *
 * @package Fastly\Cdn\Controller\Adminhtml\FastlyCdn\Vcl
 */
class Blocking extends Action
{
    /**
     * @var Http
     */
    private $request;
    /**
     * @var JsonFactory
     */
    private $resultJson;
    /**
     * @var Config
     */
    private $config;
    /**
     * @var Api
     */
    private $api;
    /**
     * @var Vcl
     */
    private $vcl;

    /**
     * Blocking constructor.
     *
     * @param Context $context
     * @param Http $request
     * @param JsonFactory $resultJsonFactory
     * @param Config $config
     * @param Api $api
     * @param Vcl $vcl
     */
    public function __construct(
        Context $context,
        Http $request,
        JsonFactory $resultJsonFactory,
        Config $config,
        Api $api,
        Vcl $vcl
    ) {
        $this->request = $request;
        $this->resultJson = $resultJsonFactory;
        $this->config = $config;
        $this->api = $api;
        $this->vcl = $vcl;
        parent::__construct($context);
    }

    /**
     * Upload Blocking snippets
     *
     * @return $this|\Magento\Framework\App\ResponseInterface|\Magento\Framework\Controller\ResultInterface
     */
    public function execute()
    {
        $result = $this->resultJson->create();
        try {
            $activeVersion = $this->getRequest()->getParam('active_version');
            $activateVcl = $this->getRequest()->getParam('activate_flag');
            $service = $this->api->checkServiceDetails();
            $this->vcl->checkCurrentVersionActive($service->versions, $activeVersion);
            $currActiveVersion = $this->vcl->getCurrentVersion($service->versions);

            $clone = $this->api->cloneVersion($currActiveVersion);

            $reqName = Config::FASTLY_MAGENTO_MODULE . '_blocking';
            $checkIfReqExist = $this->api->getRequest($activeVersion, $reqName);
            $snippet = $this->config->getVclSnippets(
                Config::VCL_BLOCKING_PATH,
                Config::VCL_BLOCKING_SNIPPET
            );

            $country_codes = $this->prepareCountryCodes($this->config->getBlockByCountry());
            $acls = $this->prepareAcls($this->config->getBlockByAcl());

            $blockedItems = $country_codes . $acls;
            $strippedBlockedItems = substr($blockedItems, 0, strrpos($blockedItems, '||', -1));

            $condition = [
                'name'      => Config::FASTLY_MAGENTO_MODULE . '_block',
                'statement' => 'req.http.x-pass',
                'type'      => 'REQUEST',
                'priority'  => 5
            ];

            $createCondition = $this->api->createCondition($clone->number, $condition);

            if (!$checkIfReqExist) {
                $request = [
                    'name'              => $reqName,
                    'service_id'        => $service->id,
                    'version'           => $currActiveVersion['active_version'],
                    'force_ssl'         => true,
                    'request_condition' => $createCondition->name
                ];

                $this->api->createRequest($clone->number, $request);

                // Add blocking snippet
                foreach ($snippet as $key => $value) {
                    if ($strippedBlockedItems === '') {
                        $value = '';
                    } else {
                        $strippedBlockedItems = $this->config->processBlockedItems($strippedBlockedItems);
                        $value = str_replace('####BLOCKED_ITEMS####', $strippedBlockedItems, $value);
                    }

                    $snippetData = [
                        'name'      => Config::FASTLY_MAGENTO_MODULE . '_blocking_' . $key,
                        'type'      => $key,
                        'dynamic'   => 1,
                        'priority'  => 5,
                        'content'   => $value
                    ];

                    $this->api->uploadSnippet($clone->number, $snippetData);
                }
            } else {
                $this->api->deleteRequest($clone->number, $reqName);

                // Remove blocking snippet
                foreach ($snippet as $key => $value) {
                    $name = Config::FASTLY_MAGENTO_MODULE . '_blocking_' . $key;
                    if ($this->api->hasSnippet($clone->number, $name) == true) {
                        $this->api->removeSnippet($clone->number, $name);
                    }
                }
            }

            $this->api->validateServiceVersion($clone->number);

            if ($activateVcl === 'true') {
                $this->api->activateVersion($clone->number);
            }

            if ($this->config->areWebHooksEnabled() && $this->config->canPublishConfigChanges()) {
                if ($checkIfReqExist) {
                    $this->api->sendWebHook('*Blocking has been turned OFF in Fastly version ' . $clone->number . '*');
                } else {
                    $this->api->sendWebHook('*Blocking has been turned ON in Fastly version ' . $clone->number . '*');
                }
            }

            return $result->setData([
                'status' => true
            ]);
        } catch (\Exception $e) {
            return $result->setData([
                'status'    => false,
                'msg'       => $e->getMessage()
            ]);
        }
    }

    /**
     * Prepares ACL VCL snippets
     *
     * @param $blockedAcls
     * @return string
     */
    private function prepareAcls($blockedAcls)
    {
        $result = '';

        if ($blockedAcls != null) {
            $blockedAclsPieces = explode(",", $blockedAcls);
            foreach ($blockedAclsPieces as $acl) {
                $result .= ' req.http.Fastly-Client-Ip ~ ' . $acl . ' ||';
            }
        }

        return $result;
    }

    /**
     * Prepares blocked countries VCL snippet
     *
     * @param $blockedCountries
     * @return string
     */
    private function prepareCountryCodes($blockedCountries)
    {
        $result = '';

        if ($blockedCountries != null) {
            $blockedCountriesPieces = explode(",", $blockedCountries);
            foreach ($blockedCountriesPieces as $code) {
                $result .= ' client.geo.country_code == "' . $code . '" ||';
            }
        }

        return $result;
    }
}
