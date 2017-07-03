define([
    "jquery",
    'mage/template',
    "Magento_Ui/js/modal/modal",
    'mage/translate',
    'mage/validation'
], function($){

    return function (config) {

        var requestStateSpan = '';
        var requestStateMsgSpan = '';

        $('#system_full_page_cache_caching_application').on('change', function () {
            if($(this).val() == 'fastly') {
                init();
            }
        });

        $(document).ready(function () {
            if (config.isFastlyEnabled) {
                init();
            }

            /**
             * Add new dictionary item
             */

            $('body').on('click', '#add-dictionary-item', function(e) {
                $('#dictionary-items-table > tbody').append('<tr><td><input name="key" required="required" class="input-text admin__control-text dictionary-items-field" type="text"></td>' +
                    '<td><input name="value" data-type="dictionary" required="required" class="input-text admin__control-text dictionary-items-field" type="text"></td>' +
                    '<td class="col-actions">' +
                    '<button class="action-delete fastly-save-action save_item" title="Save" type="button"><span>Save</span></button>' +
                    '<button class="action-delete remove_item"  title="Delete" type="button"><span>Delete</span></button>' +
                    '</td></tr>');
            });

            /**
             * Add new acl item
             */

            $('body').on('click', '#add-acl-item', function(e) {
                var aclTimestamp = Math.round(e.timeStamp);
                $('#acl-items-table > tbody').append('<tr>' +
                    '<td><input name="value" data-type="acl" data-id="" required="required" class="input-text admin__control-text dictionary-items-field" type="text"></td>' +
                    '<td><div class="admin__field-option"><input name="negated" class="admin__control-checkbox" type="checkbox" id="acl_entry_'+ aclTimestamp +'"><label class="admin__field-label" for="acl_entry_'+ aclTimestamp +'"></label></div></td>' +
                    '<td class="col-actions">' +
                    '<button class="action-delete fastly-save-action save_item" title="Save" type="button"><span>Save</span></button>' +
                    '<button class="action-delete remove_item"  title="Delete" type="button"><span>Delete</span></button>' +
                    '</td></tr>');
            });

            /**
             * Handles dictionary and ACL item removing
             */

            $('body').on('click', '.remove_item', function(e) {
                e.preventDefault();
                var valueField = $(this).closest('tr').find("input[name='value']");
                var item_key = $(this).closest('tr').find("input[name='key']").val();
                var self = this;
                var type = valueField.data('type');

                if (confirm("Are you sure you want to delete this item?")) {
                    if(type === 'acl') {
                        var acl_item_id = valueField.data('id');
                        vcl.deleteAclItem(acl_id, acl_item_id, true).done(function (response) {
                            if (response.status == true) {
                                $(self).closest('tr').remove();
                                vcl.showSuccessMessage($.mage.__('Acl item is successfully deleted.'));
                            }
                        }).fail(function () {
                            vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                        });
                    } else {
                        vcl.deleteEdgeDictionaryItem(dictionary_id, item_key, true).done(function (response) {
                            if (response.status == true) {
                                $(self).closest('tr').remove();
                                vcl.showSuccessMessage($.mage.__('Dictionary item is successfully deleted.'));
                            }
                        }).fail(function () {
                            vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                        });
                    }
                }
            });

            /**
             * Handles dictionary and ACL item saving
             */

            $('body').on('click', '.save_item', function(e) {
                e.preventDefault();
                var keyField = $(this).closest('tr').find("input[name='key']");
                var valueField = $(this).closest('tr').find("input[name='value']");
                var item_key = keyField.val();
                var item_value = valueField.val();
                var errors = false;
                var type = valueField.data('type');

                if (item_key == '' && type !== 'acl')
                {
                    errors = true;
                    keyField.css('border-color', '#e22626');
                } else {
                    keyField.css('border-color', '#878787');
                }

                if (item_value == '')
                {
                    errors = true;
                    valueField.css('border-color', '#e22626');
                } else {
                    valueField.css('border-color', '#878787');
                }

                if (errors)
                {
                    vcl.resetAllMessages();
                    return vcl.showErrorMessage($.mage.__('Please enter all required fields.'));
                }

                var self = this;
                if(type === 'acl') {
                    var negated_field = $(this).closest('tr').find("input[name='negated']")[0].checked ? 1 : 0;
                    vcl.saveAclItem(acl_id, item_value, negated_field, true).done(function (response) {
                        if (response.status == true) {
                            $(self).closest('tr').find("input[name='value']").prop('disabled', true);
                            var newElement = $(self).closest('tr').find("input[name='value']")[0];
                            newElement.setAttribute('data-id', response.id);
                            
                            vcl.showSuccessMessage($.mage.__('Acl item is successfully saved.'));
                        } else {
                            vcl.showErrorMessage(response.msg);
                        }
                    }).fail(function () {
                        vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                    });
                } else {
                    vcl.saveEdgeDictionaryItem(dictionary_id, item_key, item_value, true).done(function (response) {
                        if (response.status == true) {
                            $(self).closest('tr').find("input[name='key']").prop('disabled', true);
                            vcl.showSuccessMessage($.mage.__('Dictionary item is successfully saved.'));
                        } else {
                            vcl.showErrorMessage(response.msg);
                        }
                    }).fail(function () {
                        vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                    });
                }
            });
        });

        function init() {
            $.ajax({
                type: "GET",
                url: config.isAlreadyConfiguredUrl
            }).done(function (response) {
                if(response.status == true) {
                    isAlreadyConfigured = response.flag;
                }
            });

            // Checking service status & presence of force_tls request setting
            requestStateSpan = $('#request_state_span');
            requestStateMsgSpan = $('#fastly_request_state_message_span');
            $.ajax({
                type: "GET",
                url: config.serviceInfoUrl,
                beforeSend: function (xhr) {
                    requestStateSpan.find('.processing').show();
                }
            }).done(function (checkService) {
                if (checkService.status != false) {
                    active_version = checkService.active_version;
                    next_version = checkService.next_version;
                    // Fetch force tls req setting status
                    var tls = vcl.getTlsSetting(checkService.active_version, false);
                    tls.done(function (checkReqSetting) {
                            requestStateSpan.find('.processing').hide();
                            if (checkReqSetting.status != false) {
                                requestStateMsgSpan.find('#force_tls_state_enabled').show();
                            } else {
                                requestStateMsgSpan.find('#force_tls_state_disabled').show();
                            }
                        }
                    ).fail(function () {
                        requestStateSpan.find('.processing').hide();
                        requestStateMsgSpan.find('#force_tls_state_unknown').show();
                    });

                    // Fetch backends
                    vcl.getBackends(active_version, false).done(function (backendsResp) {
                        $('.loading-backends').hide();
                        if(backendsResp.status != false) {
                            if(backendsResp.backends.length > 0) {
                                backends = backendsResp.backends;
                                vcl.processBackends(backendsResp.backends);
                            } else {
                                $('.no-backends').show();
                            }
                        }
                    }).fail(function () {
                        // TO DO: implement
                    });

                    // Fetch dictionaries
                    vcl.listDictionaries(active_version, false).done(function (dictResp) {
                        $('.loading-dictionaries').hide();
                        if(dictResp.status != false) {
                            if(dictResp.status != false) {
                                if(dictResp.dictionaries.length > 0) {
                                    dictionaries = dictResp.dictionaries;
                                    vcl.processDictionaries(dictResp.dictionaries);
                                } else {
                                    $('.no-dictionaries').show();
                                }
                            }
                        }
                    }).fail(function () {
                        return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    });

                    // Fetch ACLs
                    vcl.listAcls(active_version, false).done(function (aclResp) {
                        $('.loading-dictionaries').hide();
                        if(aclResp.status != false) {
                            if(aclResp.status != false) {
                                if(aclResp.acls.length > 0) {
                                    acls = aclResp.acls;
                                    vcl.processAcls(aclResp.acls);
                                } else {
                                    $('.no-dictionaries').show();
                                }
                            }
                        }
                    }).fail(function () {
                        return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    });
                } else {
                    requestStateSpan.find('.processing').hide();
                    requestStateMsgSpan.find('#force_tls_state_unknown').show();
                }
            }).fail(function () {
                requestStateMsgSpan.find('#force_tls_state_unknown').show();
            });
        }

        /**
         * Backend Edit icon
         */

        $('body').on('click', 'button.fastly-edit-backend-icon', function() {
            $.ajax({
                type: "GET",
                url: config.serviceInfoUrl
            }).done(function (checkService) {
                active_version = checkService.active_version;
                next_version = checkService.next_version;
                service_name = checkService.service.name;
                vcl.setActiveServiceLabel(active_version, next_version, service_name);
            });

            var backend_id = $(this).data('backend-id');
            if(backends != null && backend_id != null) {
                vcl.showPopup('fastly-backend-options');
                var backend_name = "Backend " + backends[backend_id].name;
                $('.modal-title').text($.mage.__(backend_name));
                $('#backend_name').val(backends[backend_id].name);
                $('#backend_shield option[value=' + backends[backend_id].shield +']').attr('selected','selected');
                $('#backend_connect_timeout').val(backends[backend_id].connect_timeout);
                $('#backend_between_bytes_timeout').val(backends[backend_id].between_bytes_timeout);
                $('#backend_first_byte_timeout').val(backends[backend_id].first_byte_timeout);
            }
        });

        /**
         * Dictionary/ACL Edit icon
         */

        $('body').on('click', 'button.fastly-edit-dictionary-icon', function() {
            $.ajax({
                type: "GET",
                url: config.serviceInfoUrl
            }).done(function (checkService) {
                active_version = checkService.active_version;
                next_version = checkService.next_version;
                service_name = checkService.service.name;
                vcl.setActiveServiceLabel(active_version, next_version, service_name);
            });

            dictionary_id = $(this).data('dictionary-id');
            acl_id = $(this).data('acl-id');
            // Handle Dictionaries
            if(dictionary_id) {
                if(dictionaries != null && dictionary_id != null) {
                    $.ajax({
                        type: "POST",
                        url: config.getDictionaryItems,
                        showLoader: true,
                        data: {'dictionary_id': dictionary_id}
                    }).done(function (response) {
                        if (response.status == true) {
                            dictionaryItems = response.dictionaryItems;
                            var itemsHtml = '';
                            if (response.dictionaryItems.length > 0) {
                                $.each(response.dictionaryItems, function (index, item) {
                                    itemsHtml += '<tr><td>' +
                                        '<input name="key" value="'+ item.item_key +'" class="input-text admin__control-text dictionary-items-field" type="text" disabled></td>' +
                                        '<td><input name="value" data-type="dictionary" value="'+ item.item_value +'" class="input-text admin__control-text dictionary-items-field" type="text"></td>' +
                                        '<td class="col-actions">' +
                                        '<button class="action-delete fastly-save-action save_item" title="Save" type="button"><span>Save</span></button>' +
                                        '<button class="action-delete remove_item"  title="Delete" type="button"><span>Delete</span></button>' +
                                        '</td></tr>';
                                });
                            }
                        } else {
                            dictionaryItems = [];
                        }
                        vcl.showPopup('fastly-edge-items');
                        $('.upload-button').remove();

                        if (itemsHtml != '')
                        {
                            $('#dictionary-items-table > tbody').html(itemsHtml);
                        }
                    });
                }
            } else {
                // Handle ACLs
                if(acls != null && acl_id != null) {
                    $.ajax({
                        type: "POST",
                        url: config.getAclItems,
                        showLoader: true,
                        data: {'acl_id': acl_id}
                    }).done(function (response) {
                        if (response.status == true) {
                            aclItems = response.aclItems;
                            var itemsHtml = '';
                            if (response.aclItems.length > 0) {
                                $.each(response.aclItems, function (index, item) {
                                    var negated = item.negated == 1 ? ' checked' : '';
                                    if(item.subnet) {
                                        ip_output = item.ip + '/' + item.subnet;
                                    } else {
                                        ip_output = item.ip;
                                    }
                                    itemsHtml += '<tr><td>' +
                                        '<input name="value" data-type="acl" data-id="'+ item.id +'" value="'+ ip_output +'" class="input-text admin__control-text dictionary-items-field" type="text" disabled></td>' +
                                        '<td><div class="admin__field-option"><input name="negated" class="admin__control-checkbox" type="checkbox" id="acl_entry_'+ item.id +'"'+negated+'><label class="admin__field-label" for="acl_entry_'+ item.id +'"></label></div></td>' +
                                        '<td class="col-actions">' +
                                        '<button class="action-delete fastly-save-action save_item" title="Save" type="button"><span>Save</span></button>' +
                                        '<button class="action-delete remove_item"  title="Delete" type="button"><span>Delete</span></button>' +
                                        '</td></tr>';
                                });
                            }
                        } else {
                            aclItems = [];
                        }
                        vcl.showPopup('fastly-acl-items');
                        $('.upload-button').remove();

                        if (itemsHtml != '') {
                            $('#acl-items-table > tbody').html(itemsHtml);
                        }
                    });
                }
            }
        });

        /**
         * VCL Upload button
         */

        $('#fastly_vcl_upload_button').on('click', function () {

            if(isAlreadyConfigured != true) {
                $(this).attr('disabled', true);
                return alert($.mage.__('Please save config prior to continuing.'));
            }

            vcl.resetAllMessages();

            $.when(
                $.ajax({
                    type: "GET",
                    url: config.serviceInfoUrl,
                    showLoader: true
                })
            ).done(function (service) {

                if(service.status == false) {
                    return errorVclBtnMsg.text($.mage.__('Please check your Service ID and API token and try again.')).show();
                }

                active_version = service.active_version;
                next_version = service.next_version;
                service_name = service.service.name;
                vcl.showPopup('fastly-uploadvcl-options');
                vcl.setActiveServiceLabel(active_version, next_version, service_name);

            }).fail(function () {
                return errorVclBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
            });
        });

        /**
         * Force TLS button
         */

        $('#fastly_force_tls_button').on('click', function () {

            if(isAlreadyConfigured != true) {
                $(this).attr('disabled', true);
                return alert($.mage.__('Please save config prior to continuing.'));
            }

            vcl.resetAllMessages();

            $.ajax({
                type: "GET",
                url: config.serviceInfoUrl,
                showLoader: true
            }).done(function (service) {

                if(service.status == false) {
                    return errorVclBtnMsg.text($.mage.__('Please check your Service ID and API token and try again.')).show();
                }

                active_version = service.active_version;
                next_version = service.next_version;
                service_name = service.service.name;
                vcl.getTlsSetting(active_version, true).done(function (response) {
                        if(response.status == false) {
                            $('.modal-title').text($.mage.__('We are about to turn on TLS'));
                        } else {
                            $('.modal-title').text($.mage.__('We are about to turn off TLS'));
                        }
                        forceTls = response.status;
                    }
                ).fail(function () {
                        vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'))
                    }
                );
                vcl.showPopup('fastly-tls-options');
                vcl.setActiveServiceLabel(active_version, next_version, service_name);

            }).fail(function (msg) {
                return errorTlsBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
            });
        });

        /**
         * Set Error Page HTML button
         */

        $('#fastly_error_page_button').on('click', function () {

            if(isAlreadyConfigured != true) {
                $(this).attr('disabled', true);
                return alert($.mage.__('Please save config prior to continuing.'));
            }

            vcl.resetAllMessages();

            $.when(
                $.ajax({
                    type: "GET",
                    url: config.serviceInfoUrl,
                    showLoader: true
                })
            ).done(function (service) {

                if(service.status == false) {
                    return errorHtmlBtnMsg.text($.mage.__('Please check your Service ID and API token and try again.')).show();
                }

                active_version = service.active_version;
                next_version = service.next_version;
                service_name = service.service.name;

                vcl.getErrorPageRespObj(active_version, true).done(function (response) {
                    if(response.status == true) {
                        $('#error_page_html').text(response.errorPageResp.content).html();
                    }
                }).fail(function() {
                    vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                });

                vcl.showPopup('fastly-error-page-options');
                vcl.setActiveServiceLabel(active_version, next_version, service_name);

            }).fail(function () {
                return errorHtmlBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
            });
        });

        /**
         * Add dictionary container button
         */

        $('#add-dictionary-container-button').on('click', function () {

            if(isAlreadyConfigured != true) {
                $(this).attr('disabled', true);
                return alert($.mage.__('Please save config prior to continuing.'));
            }

            vcl.resetAllMessages();

            $.when(
                $.ajax({
                    type: "GET",
                    url: config.serviceInfoUrl,
                    showLoader: true
                })
            ).done(function (service) {

                if(service.status == false) {
                    return errorHtmlBtnMsg.text($.mage.__('Please check your Service ID and API token and try again.')).show();
                }

                active_version = service.active_version;
                next_version = service.next_version;
                service_name = service.service.name;

                vcl.getErrorPageRespObj(active_version, true).done(function (response) {
                    if(response.status == true) {
                        $('#error_page_html').text(response.errorPageResp.content).html();
                    }
                }).fail(function() {
                    vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                });

                vcl.showPopup('fastly-dictionary-container-options');
                vcl.setActiveServiceLabel(active_version, next_version, service_name);

            }).fail(function () {
                return errorHtmlBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
            });
        });

            /**
             * Add dictionary container button
             */

            $('#add-acl-container-button').on('click', function () {

                if(isAlreadyConfigured != true) {
                    $(this).attr('disabled', true);
                    return alert($.mage.__('Please save config prior to continuing.'));
                }

                vcl.resetAllMessages();

                $.when(
                    $.ajax({
                        type: "GET",
                        url: config.serviceInfoUrl,
                        showLoader: true
                    })
                ).done(function (service) {

                    if(service.status == false) {
                        return errorHtmlBtnMsg.text($.mage.__('Please check your Service ID and API token and try again.')).show();
                    }

                    active_version = service.active_version;
                    next_version = service.next_version;
                    service_name = service.service.name;

                    vcl.getErrorPageRespObj(active_version, true).done(function (response) {
                        if(response.status == true) {
                            $('#error_page_html').text(response.errorPageResp.content).html();
                        }
                    }).fail(function() {
                        vcl.showErrorMessage($.mage.__('An error occurred while processing your request. Please try again.'));
                    });

                    vcl.showPopup('fastly-acl-container-options');
                    vcl.setActiveServiceLabel(active_version, next_version, service_name);

                }).fail(function () {
                    return errorHtmlBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                });
            });

        var backends = null;
        var dictionaries = null;
        var dictionary_id = null;
        var acls = null;
        var acl_id = null;
        var dictionaryItems = null;
        var active_version = '';
        var next_version = '';
        var service_name;
        var forceTls = true;
        var isAlreadyConfigured = true;
        /* VCL button messages */
        var successVclBtnMsg = $('#fastly-success-vcl-button-msg');
        var errorVclBtnMsg = $('#fastly-error-vcl-button-msg');
        var warningVclBtnMsg = $('#fastly-warning-vcl-button-msg');
        /* TLS button messages */
        var successTlsBtnMsg = $('#fastly-success-tls-button-msg');
        var errorTlsBtnMsg = $('#fastly-error-tls-button-msg');
        var warningTlsBtnMsg = $('#fastly-warning-tls-button-msg');
        /*Error page HTML button */
        var successHtmlBtnMsg = $('#fastly-success-html-page-button-msg');
        var errorHtmlBtnMsg = $('#fastly-error-html-page-button-msg');
        var warningHtmlBtnMsg = $('#fastly-warning-html-page-button-msg');
        /*Dictionary button */
        var successDictionaryBtnMsg = $('#fastly-success-edge-button-msg');
        var errorDictionaryBtnMsg = $('#fastly-error-edge-button-msg');

        var vcl = {

            showPopup: function(divId) {
                var self = this;

                this.modal = jQuery('<div/>').attr({id: divId}).html(this.uploadVclConfig[divId].content()).modal({
                    modalClass: 'magento',
                    title: this.uploadVclConfig[divId].title,
                    type: 'slide',
                    closed: function(e, modal){
                        modal.modal.remove();
                    },
                    opened: function () {
                        if (self.uploadVclConfig[divId].opened) {
                            self.uploadVclConfig[divId].opened.call(self);
                        }
                    },
                    buttons: [{
                        text: jQuery.mage.__('Cancel'),
                        'class': 'action cancel',
                        click: function () {
                            this.closeModal();
                        }
                    }, {
                        text: jQuery.mage.__('Upload'),
                        'class': 'action primary upload-button',
                        click: function () {
                            self.uploadVclConfig[divId].actionOk.call(self);
                        }
                    }]
                });
                this.modal.modal('openModal');
            },

            // Queries Fastly API to retrive services
            getService: function() {
                $.ajax({
                    type: "GET",
                    url: config.serviceInfoUrl,
                    showLoader: true,
                    success: function(response)
                    {
                        if(response != false) {
                            vcl.setActiveServiceLabel(active_version, next_version);
                        }
                    },
                    error: function(msg)
                    {
                        // TODO: error handling
                    }
                });
            },

            // Queries Fastly API to retrive Tls setting
            getTlsSetting: function(active_version, loaderVisibility) {
                return $.ajax({
                    type: "POST",
                    url: config.checkTlsSettingUrl,
                    showLoader: loaderVisibility,
                    data: {'active_version': active_version}
                });
            },

            // Queries Fastly API to retrive Backends
            getBackends: function(active_version, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.fetchBackendsUrl,
                    showLoader: loaderVisibility,
                    data: {'active_version': active_version},
                    beforeSend: function (xhr) {
                        $('.loading-backends').show();
                    }
                });
            },

            // Queries Fastly API to retrive Backends
            getErrorPageRespObj: function(active_version, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.getErrorPageRespObj,
                    showLoader: loaderVisibility,
                    data: {'active_version': active_version}
                });
            },

            // Process backends
            processBackends: function(backends) {
                $.each(backends, function (index, backend) {
                    var html = "<tr id='fastly_" + index + "'>";
                    html += "<td><input data-backendId='"+ index + "' id='backend_" + index + "' value='"+ backend.name +"' disabled='disabled' class='input-text' type='text'></td>";
                    html += "<td class='col-actions'><button class='action-delete fastly-edit-backend-icon' data-backend-id='" + index + "' id='fastly-edit-backend_"+ index + "' title='Edit backend' type='button'></td></tr>";
                    $('#fastly-backends-list').append(html);

                });
            },

            // Process dictionaries
            processDictionaries: function(dictionaries) {
                var html = '';
                $.each(dictionaries, function (index, dictionary) {
                    html += "<tr id='fastly_dict_" + index + "'>";
                    html += "<td><input data-dictionaryId='"+ dictionary.id + "' id='dict_" + index + "' value='"+ dictionary.name +"' disabled='disabled' class='input-text' type='text'></td>";
                    html += "<td class='col-actions'><button class='action-delete fastly-edit-dictionary-icon' data-dictionary-id='" + dictionary.id + "' id='fastly-edit-dictionary_"+ index + "' title='Edit dictionary' type='button'></td></tr>";
                });
                if (html != '') {
                    $('.no-dictionaries').hide();
                }
                $('#fastly-dictionaries-list').html(html);
            },

            // Queries Fastly API to retrive Dictionaries
            listDictionaries: function(active_version, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.getDictionaries,
                    showLoader: loaderVisibility,
                    data: {'active_version': active_version},
                    beforeSend: function (xhr) {
                        $('.loading-dictionaries').show();
                    }
                });
            },

            // Queries Fastly API to retrive ACLs
            listAcls: function(active_version, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.getAcls,
                    showLoader: loaderVisibility,
                    data: {'active_version': active_version},
                    beforeSend: function (xhr) {
                        $('.loading-dictionaries').show();
                    }
                });
            },

            // Process ACLs
            processAcls: function(acls) {
                var html = '';
                $.each(acls, function (index, acl) {
                    html += "<tr id='fastly_acl_" + index + "'>";
                    html += "<td><input data-aclId='"+ acl.id + "' id='acl_" + index + "' value='"+ acl.name +"' disabled='disabled' class='input-text' type='text'></td>";
                    html += "<td class='col-actions'><button class='action-delete fastly-edit-dictionary-icon' data-acl-id='" + acl.id + "' id='fastly-edit-acl_"+ index + "' title='Edit Acl' type='button'></td></tr>";
                });
                if (html != '') {
                    $('.no-dictionaries').hide();
                }
                $('#fastly-acls-list').html(html);
            },

            // Delete Edge Dictionary item
            deleteEdgeDictionaryItem: function(dictionary_id, item_key, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.deleteDictionaryItem,
                    showLoader: loaderVisibility,
                    data: {'dictionary_id': dictionary_id, 'item_key': item_key},
                    beforeSend: function (xhr) {
                        vcl.resetAllMessages();
                    }
                });
            },

            // Save Edge Dictionary item
            saveEdgeDictionaryItem: function(dictionary_id, item_key, item_value, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.createDictionaryItem,
                    showLoader: loaderVisibility,
                    data: {'dictionary_id': dictionary_id, 'item_key': item_key, 'item_value': item_value},
                    beforeSend: function (xhr) {
                        vcl.resetAllMessages();
                    }
                });
            },

            // Delete Acl entry item
            deleteAclItem: function(acl_id, acl_item_id, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.deleteAclItem,
                    showLoader: loaderVisibility,
                    data: {'acl_id': acl_id, 'acl_item_id': acl_item_id},
                    beforeSend: function (xhr) {
                        vcl.resetAllMessages();
                    }
                });
            },

            // Save Acl entry item
            saveAclItem: function(acl_id, item_value, negated_field, loaderVisibility) {
                return $.ajax({
                    type: "GET",
                    url: config.createAclItem,
                    showLoader: loaderVisibility,
                    data: {'acl_id': acl_id, 'item_value': item_value, 'negated_field': negated_field},
                    beforeSend: function (xhr) {
                        vcl.resetAllMessages();
                    }
                });
            },

            // Setting up label text
            setActiveServiceLabel: function (active_version, next_version, service_name) {
                var msgWarning = $('.fastly-message-warning');
                msgWarning.text($.mage.__('You are about to clone service **' + service_name + '** active version') + ' ' + active_version + '. '
                    + $.mage.__('We\'ll make changes to version ') + ' ' + next_version + '.');
                msgWarning.show();
            },

            // Upload process
            submitVcl: function () {
                var activate_vcl_flag = false;

                if($('#fastly_activate_vcl').is(':checked')) {
                    activate_vcl_flag = true;
                }

                $.ajax({
                    type: "POST",
                    url: config.vclUploadUrl,
                    data: {
                        'activate_flag': activate_vcl_flag,
                        'active_version': active_version
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            active_version = response.active_version;
                            vcl.modal.modal('closeModal');
                            successVclBtnMsg.text($.mage.__('VCL file is successfully uploaded to the Fastly service.')).show();
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        // TODO: error handling
                    }
                });
            },

            // Toggle Tls process
            toggleTls: function (active_version) {
                var activate_tls_flag = false;

                if($('#fastly_activate_tls').is(':checked')) {
                    activate_tls_flag = true;
                }

                $.ajax({
                    type: "POST",
                    url: config.toggleTlsSettingUrl,
                    data: {
                        'activate_flag': activate_tls_flag,
                        'active_version': active_version
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            vcl.modal.modal('closeModal');
                            var onOrOff = 'off';
                            var disabledOrEnabled = 'disabled';
                            if(forceTls == false) {
                                onOrOff = 'on';
                                disabledOrEnabled = 'enabled';
                            } else {
                                onOrOff = 'off';
                                disabledOrEnabled = 'disabled';
                            }
                            successTlsBtnMsg.text($.mage.__('The Force TLS request setting is successfully turned ' + onOrOff + '.')).show();
                            $('.request_tls_state_span').hide();
                            if(disabledOrEnabled == 'enabled') {
                                requestStateMsgSpan.find('#force_tls_state_disabled').hide();
                                requestStateMsgSpan.find('#force_tls_state_enabled').show();
                            } else {
                                requestStateMsgSpan.find('#force_tls_state_enabled').hide();
                                requestStateMsgSpan.find('#force_tls_state_disabled').show();
                            }
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        // TODO: error handling
                    }
                });
            },

            // Reconfigure backend
            configureBackend: function () {
                var activate_backend = false;

                if($('#fastly_activate_backend').is(':checked')) {
                    activate_backend = true;
                }

                $.ajax({
                    type: "POST",
                    url: config.configureBackendUrl,
                    data: {
                        'active_version': active_version,
                        'activate_flag': activate_backend,
                        'name': $('#backend_name').val(),
                        'shield': $('#backend_shield').val(),
                        'connect_timeout': $('#backend_connect_timeout').val(),
                        'between_bytes_timeout': $('#backend_between_bytes_timeout').val(),
                        'first_byte_timeout': $('#backend_first_byte_timeout').val()
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            $('#fastly-success-backend-button-msg').text($.mage.__('Backend is successfully updated.')).show();
                            active_version = response.active_version;
                            vcl.modal.modal('closeModal');
                            $('#fastly-backends-list').html('');
                            vcl.getBackends(response.active_version, false).done(function (backendsResp) {
                                $('.loading-backends').hide();
                                if(backendsResp.status != false) {
                                    if(backendsResp.backends.length > 0) {
                                        backends = backendsResp.backends;
                                        vcl.processBackends(backendsResp.backends);
                                    }
                                }
                            }).fail(function () {
                                $('#fastly-error-backend-button-msg').text($.mage.__('Error while updating the backend. Please, try again.')).show();
                            });
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        // TODO: error handling
                    }
                });
            },

            // Save Error Page Html
            saveErrorHtml: function () {
                var activate_vcl = false;

                if($('#fastly_activate_vcl').is(':checked')) {
                    activate_vcl = true;
                }

                $.ajax({
                    type: "POST",
                    url: config.saveErrorPageHtmlUrl,
                    data: {
                        'active_version': active_version,
                        'activate_flag': activate_vcl,
                        'html': $('#error_page_html').val()
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            successHtmlBtnMsg.text($.mage.__('Error page HTML is successfully updated.')).show();
                            active_version = response.active_version;
                            vcl.modal.modal('closeModal');
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        return errorHtmlBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    }
                });
            },

            // CreateDictionary
            createDictionary: function () {
                var activate_vcl = false;

                if($('#fastly_activate_vcl').is(':checked')) {
                    activate_vcl = true;
                }

                $.ajax({
                    type: "POST",
                    url: config.createDictionary,
                    data: {
                        'active_version': active_version,
                        'activate_flag': activate_vcl,
                        'dictionary_name': $('#dictionary_name').val()
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            successDictionaryBtnMsg.text($.mage.__('Dictionary is successfully created.')).show();
                            active_version = response.active_version;
                            // Fetch dictionaries
                            vcl.listDictionaries(active_version, false).done(function (dictResp) {
                                $('.loading-dictionaries').hide();
                                if(dictResp.status != false) {
                                    if(dictResp.status != false) {
                                        if(dictResp.dictionaries.length > 0) {
                                            dictionaries = dictResp.dictionaries;
                                            vcl.processDictionaries(dictResp.dictionaries);
                                        } else {
                                            $('.no-dictionaries').show();
                                        }
                                    }
                                }
                            }).fail(function () {
                                return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                            });
                            vcl.modal.modal('closeModal');
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    }
                });
            },

            // CreateDictionaryItems
            createDictionaryItems: function () {
                var activate_vcl = false;

                if($('#fastly_activate_vcl').is(':checked')) {
                    activate_vcl = true;
                }

                var keys = [];
                $("input[type='text'][name^='key']").each(function () {
                    keys.push(this.value);
                });

                var values = [];
                $("input[type='text'][name^='value']").each(function () {
                    values.push(this.value);
                });

                $.ajax({
                    type: "POST",
                    url: config.createDictionaryItems,
                    data: {
                        'active_version': active_version,
                        'activate_flag': activate_vcl,
                        'dictionary_id': dictionary_id,
                        'values': values,
                        'keys': keys,
                        'old_items': dictionaryItems
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            successDictionaryBtnMsg.text($.mage.__('Dictionary items are successfully saved.')).show();
                            active_version = response.active_version;
                            vcl.modal.modal('closeModal');
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    }
                });
            },

            showErrorMessage: function (msg) {
                var msgError = $('.fastly-message-error');
                msgError.text($.mage.__(msg));
                msgError.show();
            },

            showSuccessMessage: function (msg) {
                var msgSuccess = $('.fastly-message-success');
                msgSuccess.text($.mage.__(msg));
                msgSuccess.show();
            },

            resetAllMessages: function () {
                var msgWarning = $('.fastly-message-warning');
                var msgError = $('.fastly-message-error');
                var msgSuccess = $('.fastly-message-success');

                // Modal window warning messages
                msgWarning.text();
                msgWarning.hide();

                // Modal windows error messages
                msgError.text();
                msgError.hide();

                // Modal windows success messages
                msgSuccess.text();
                msgSuccess.hide();

                // Vcl button messages
                successVclBtnMsg.hide();
                errorVclBtnMsg.hide();
                warningTlsBtnMsg.hide();

                // Tls button messages
                successTlsBtnMsg.hide();
                errorTlsBtnMsg.hide();
                warningTlsBtnMsg.hide();

                // Error page button messages
                successHtmlBtnMsg.hide();
                errorHtmlBtnMsg.hide();
                warningHtmlBtnMsg.hide();


                // Edge button messages
                successDictionaryBtnMsg.hide();
                errorDictionaryBtnMsg.hide();
            },

            // CreateAcl
            createAcl: function () {
                var activate_vcl = false;

                if($('#fastly_activate_vcl').is(':checked')) {
                    activate_vcl = true;
                }

                $.ajax({
                    type: "POST",
                    url: config.createAcl,
                    data: {
                        'active_version': active_version,
                        'activate_flag': activate_vcl,
                        'acl_name': $('#acl_name').val()
                    },
                    showLoader: true,
                    success: function(response)
                    {
                        if(response.status == true)
                        {
                            successDictionaryBtnMsg.text($.mage.__('Acl is successfully created.')).show();
                            active_version = response.active_version;
                            vcl.listAcls(active_version, false).done(function (aclResp) {
                                $('.loading-dictionaries').hide();
                                if(aclResp.status != false) {
                                    if(aclResp.status != false) {
                                        if(aclResp.acls.length > 0) {
                                            acls = aclResp.acls;
                                            vcl.processAcls(aclResp.acls);
                                        } else {
                                            $('.no-dictionaries').show();
                                        }
                                    }
                                }
                            }).fail(function () {
                                return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                            });
                            vcl.modal.modal('closeModal');
                        } else {
                            vcl.resetAllMessages();
                            vcl.showErrorMessage(response.msg);
                        }
                    },
                    error: function(msg)
                    {
                        return errorDictionaryBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    }
                });
            },

            uploadVclConfig: {
                'fastly-uploadvcl-options': {
                    title: jQuery.mage.__('You are about to upload VCL to Fastly '),
                    content: function () {
                        return document.getElementById('fastly-uploadvcl-template').textContent;
                    },
                    actionOk: function () {
                        vcl.submitVcl(active_version);
                    }
                },
                'fastly-tls-options': {
                    title: jQuery.mage.__(''),
                    content: function () {
                        return document.getElementById('fastly-tls-template').textContent;
                    },
                    actionOk: function () {
                        vcl.toggleTls(active_version);
                    }
                },
                'fastly-backend-options': {
                    title: jQuery.mage.__(''),
                    content: function () {
                        return document.getElementById('fastly-backend-template').textContent;
                    },
                    actionOk: function () {
                        if ($('#backend-upload-form').valid()) {
                            vcl.configureBackend(active_version);
                        }
                    }
                },
                'fastly-error-page-options': {
                    title: jQuery.mage.__('Update Error Page Content'),
                    content: function () {
                        return document.getElementById('fastly-error-page-template').textContent;
                    },
                    actionOk: function () {
                        vcl.saveErrorHtml(active_version);
                    }
                },
                'fastly-dictionary-container-options': {
                    title: jQuery.mage.__('Dictionary container'),
                    content: function () {
                        return document.getElementById('fastly-dictionary-container-template').textContent;
                    },
                    actionOk: function () {
                        vcl.createDictionary(active_version);
                    }
                },
                'fastly-acl-container-options': {
                    title: jQuery.mage.__('Acl container'),
                    content: function () {
                        return document.getElementById('fastly-acl-container-template').textContent;
                    },
                    actionOk: function () {
                        vcl.createAcl(active_version);
                    }
                },
                'fastly-edge-items': {
                    title: jQuery.mage.__('Dictionary items'),
                    content: function () {
                        return document.getElementById('fastly-edge-items-template').textContent;
                    },
                    actionOk: function () {
                    }
                },
                'fastly-acl-items': {
                    title: jQuery.mage.__('Acl items'),
                    content: function () {
                        return document.getElementById('fastly-acl-items-template').textContent;
                    },
                    actionOk: function () {
                    }
                }
            }
        };
    };
});
